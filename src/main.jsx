
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import Auth from "./Auth.jsx";
import { supabase } from "./supabase.js";
import "./style.css";

const MAX_POST_SIZE = 50 * 1024 * 1024;
const MAX_PROFILE_SIZE = 5 * 1024 * 1024;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("GLOBAL CONNECT error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="error-screen">
          <h1>Something went wrong</h1>
          <p>{this.state.error.message}</p>
          <button onClick={() => window.location.reload()}>
            Reload Website
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState("Home");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const [profile, setProfile] = useState({
    display_name: "",
    bio: "",
    avatar_url: "",
    cover_url: ""
  });

  const [posts, setPosts] = useState([]);
  const [postText, setPostText] = useState("");
  const [postFile, setPostFile] = useState(null);
  const [posting, setPosting] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [deletingPost, setDeletingPost] = useState(null);

  const [people, setPeople] = useState([]);
  const [loadingPeople, setLoadingPeople] = useState(false);

  const [connections, setConnections] = useState([]);
  const [connectionProfiles, setConnectionProfiles] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [connectionAction, setConnectionAction] = useState(null);

  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const menuItems = [
    "Home",
    "Social Feed",
    "Random Video",
    "Random Audio",
    "Random Chat",
    "Messenger",
    "Discover",
    "Connections",
    "Reels",
    "Live Rooms",
    "Profile",
    "Notifications"
  ];

  const mobileItems = [
    "Home",
    "Social Feed",
    "Discover",
    "Messenger",
    "Profile"
  ];

  const displayName =
    profile.display_name ||
    user?.user_metadata?.display_name ||
    user?.email?.split("@")[0] ||
    "Member";

  function showNotice(message) {
    setNotice(message);
    window.clearTimeout(showNotice.timer);
    showNotice.timer = window.setTimeout(() => {
      setNotice("");
    }, 4500);
  }

  useEffect(() => {
    let alive = true;

    async function initialize() {
      const { data, error } = await supabase.auth.getSession();

      if (!alive) return;

      if (error) console.error(error);

      setUser(data?.session?.user || null);
      setChecking(false);
    }

    initialize();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
        setChecking(false);
      }
    );

    return () => {
      alive = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile({
        display_name: "",
        bio: "",
        avatar_url: "",
        cover_url: ""
      });

      setPosts([]);
      setPeople([]);
      setConnections([]);
      setConnectionProfiles([]);
      setSelectedChat(null);
      setMessages([]);
      return;
    }

    loadProfile();
    loadPosts();
    loadConnections();
  }, [user?.id]);

  useEffect(() => {
    if (page === "Discover") loadPeople();

    if (page === "Connections") loadConnections();

    if (page === "Social Feed" || page === "Reels") {
      loadPosts();
    }
  }, [page]);

  useEffect(() => {
    if (!user || !selectedChat) return;

    loadMessages(selectedChat.id);

    const channel = supabase
      .channel(`messages-${user.id}-${selectedChat.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages"
        },
        (payload) => {
          const row = payload.new || payload.old;

          if (
            row &&
            (row.sender_id === user.id ||
              row.receiver_id === user.id)
          ) {
            loadMessages(selectedChat.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, selectedChat?.id]);

  async function loadProfile() {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      showNotice("Profile error: " + error.message);
      return;
    }

    if (data) {
      setProfile({
        display_name: data.display_name || "",
        bio: data.bio || "",
        avatar_url: data.avatar_url || "",
        cover_url: data.cover_url || ""
      });
    } else {
      setProfile((p) => ({
        ...p,
        display_name:
          user.user_metadata?.display_name ||
          user.email?.split("@")[0] ||
          "Member"
      }));
    }
  }

  async function loadPosts() {
    if (!user) return;

    setLoadingPosts(true);

    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      showNotice("Posts loading error: " + error.message);
      setLoadingPosts(false);
      return;
    }

    const rows = data || [];

    const ids = [
      ...new Set(
        rows
          .map((p) => p.user_id || p.author_id)
          .filter(Boolean)
      )
    ];

    let profiles = [];

    if (ids.length) {
      const result = await supabase
        .from("profiles")
        .select("id,display_name,avatar_url")
        .in("id", ids);

      if (!result.error) profiles = result.data || [];
    }

    const profileMap = Object.fromEntries(
      profiles.map((p) => [p.id, p])
    );

    setPosts(
      rows.map((post) => {
        const authorId = post.user_id || post.author_id;
        const author = profileMap[authorId] || {};

        return {
          ...post,
          author_id: authorId,
          author_name: author.display_name || "Community member",
          author_avatar: author.avatar_url || ""
        };
      })
    );

    setLoadingPosts(false);
  }

  async function createPost(event) {
    event.preventDefault();

    if (!postText.trim() && !postFile) {
      return showNotice("पहले कुछ लिखें या फोटो/वीडियो चुनें।");
    }

    if (postFile && postFile.size > MAX_POST_SIZE) {
      return showNotice("फाइल 50 MB से छोटी होनी चाहिए।");
    }

    setPosting(true);

    let mediaUrl = null;
    let mediaType = null;

    if (postFile) {
      const ext =
        postFile.name.split(".").pop()?.toLowerCase() || "file";

      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("post-media")
        .upload(path, postFile, {
          upsert: false,
          contentType: postFile.type
        });

      if (uploadError) {
        showNotice("Media upload error: " + uploadError.message);
        setPosting(false);
        return;
      }

      const { data } = supabase.storage
        .from("post-media")
        .getPublicUrl(path);

      mediaUrl = data.publicUrl;

      mediaType = postFile.type.startsWith("video/")
        ? "video"
        : "image";
    }

    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      content: postText.trim(),
      media_url: mediaUrl,
      media_type: mediaType
    });

    if (error) {
      showNotice("Post publish error: " + error.message);
    } else {
      setPostText("");
      setPostFile(null);

      const input = document.getElementById("post-file-input");

      if (input) input.value = "";

      showNotice("आपकी पोस्ट publish हो गई!");

      await loadPosts();
    }

    setPosting(false);
  }

  async function deletePost(post) {
    if (!window.confirm("क्या आप यह पोस्ट delete करना चाहते हैं?")) {
      return;
    }

    setDeletingPost(post.id);

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", post.id)
      .eq("user_id", user.id);

    if (error) {
      showNotice("Delete error: " + error.message);
    } else {
      setPosts((current) =>
        current.filter((p) => p.id !== post.id)
      );

      showNotice("Post deleted.");
    }

    setDeletingPost(null);
  }

  async function loadPeople() {
    if (!user) return;

    setLoadingPeople(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id,display_name,bio,avatar_url")
      .neq("id", user.id)
      .order("display_name")
      .limit(100);

    if (error) {
      showNotice("Discover load error: " + error.message);
      setPeople([]);
    } else {
      setPeople(data || []);
    }

    setLoadingPeople(false);
  }

  // CONNECTIONS: Uses sender_id and receiver_id from your actual table.
  async function loadConnections() {
    if (!user) return;

    setLoadingConnections(true);

    const { data, error } = await supabase
      .from("connections")
      .select("*")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      showNotice("Connections load error: " + error.message);
      setLoadingConnections(false);
      return;
    }

    const rows = data || [];
    setConnections(rows);

    const ids = [
      ...new Set(
        rows
          .map((c) =>
            c.sender_id === user.id
              ? c.receiver_id
              : c.sender_id
          )
          .filter(Boolean)
      )
    ];

    if (ids.length) {
      const result = await supabase
        .from("profiles")
        .select("id,display_name,avatar_url,bio")
        .in("id", ids);

      if (result.error) {
        showNotice("Connection profiles error: " + result.error.message);
        setConnectionProfiles([]);
      } else {
        setConnectionProfiles(result.data || []);
      }
    } else {
      setConnectionProfiles([]);
    }

    setLoadingConnections(false);
  }

  function relationFor(personId) {
    return connections.find(
      (c) =>
        (c.sender_id === user.id &&
          c.receiver_id === personId) ||
        (c.receiver_id === user.id &&
          c.sender_id === personId)
    );
  }

  async function sendConnectionRequest(personId) {
    if (!user || !personId || personId === user.id) return;

    setConnectionAction(personId);

    const existing = relationFor(personId);

    if (existing?.status === "accepted") {
      showNotice("You are already connected.");
      setConnectionAction(null);
      return;
    }

    if (existing?.status === "pending") {
      showNotice("A connection request already exists.");
      setConnectionAction(null);
      return;
    }

    const { error } = await supabase
      .from("connections")
      .insert({
        sender_id: user.id,
        receiver_id: personId,
        status: "pending"
      });

    if (error) {
      showNotice("Request error: " + error.message);
    } else {
      showNotice("Connection request sent!");
      await loadConnections();
    }

    setConnectionAction(null);
  }

  async function respondToConnection(connectionId, status) {
    if (!["accepted", "rejected"].includes(status)) return;

    setConnectionAction(connectionId);

    const { error } = await supabase
      .from("connections")
      .update({ status })
      .eq("id", connectionId)
      .eq("receiver_id", user.id);

    if (error) {
      showNotice("Request update error: " + error.message);
    } else {
      showNotice(
        status === "accepted"
          ? "Connection accepted!"
          : "Request rejected."
      );

      await loadConnections();
    }

    setConnectionAction(null);
  }

  async function saveProfile(event) {
    event.preventDefault();

    setBusy(true);

    const payload = {
      id: user.id,
      display_name: profile.display_name.trim() || "Member",
      bio: profile.bio.trim(),
      avatar_url: profile.avatar_url,
      cover_url: profile.cover_url,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      showNotice("Profile save error: " + error.message);
    } else {
      showNotice("Profile saved successfully!");
    }

    setBusy(false);
  }

  async function uploadProfileImage(file, field) {
    if (!file) return;

    if (file.size > MAX_PROFILE_SIZE) {
      return showNotice("Image 5 MB से छोटी होनी चाहिए।");
    }

    setBusy(true);

    const ext =
      file.name.split(".").pop()?.toLowerCase() || "jpg";

    const path = `${user.id}/${field}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("profile-media")
      .upload(path, file, {
        upsert: true,
        contentType: file.type
      });

    if (error) {
      showNotice("Image upload error: " + error.message);
      setBusy(false);
      return;
    }

    const { data } = supabase.storage
      .from("profile-media")
      .getPublicUrl(path);

    setProfile((p) => ({
      ...p,
      [field]: data.publicUrl
    }));

    setBusy(false);

    showNotice("Image uploaded. अब Save Profile दबाएँ।");
  }

  async function loadMessages(otherUserId) {
    if (!user || !otherUserId) return;

    setLoadingMessages(true);

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      showNotice("Messages load error: " + error.message);
      setLoadingMessages(false);
      return;
    }

    setMessages(data || []);

    const unreadIds = (data || [])
      .filter(
        (m) => m.receiver_id === user.id && !m.read_at
      )
      .map((m) => m.id);

    if (unreadIds.length) {
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds);
    }

    setLoadingMessages(false);
  }

  async function sendMessage(event) {
    event.preventDefault();

    if (!messageText.trim() || !selectedChat) return;

    setSendingMessage(true);

    const { error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        receiver_id: selectedChat.id,
        content: messageText.trim()
      });

    if (error) {
      showNotice("Message send error: " + error.message);
    } else {
      setMessageText("");
      await loadMessages(selectedChat.id);
    }

    setSendingMessage(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setPage("Home");
    showNotice("You have been logged out.");
  }

  const acceptedConnections = useMemo(
    () => connections.filter((c) => c.status === "accepted"),
    [connections]
  );

  const incomingRequests = useMemo(
    () =>
      connections.filter(
        (c) =>
          c.receiver_id === user?.id &&
          c.status === "pending"
      ),
    [connections, user?.id]
  );

  const connectedPeople = useMemo(
    () =>
      acceptedConnections
        .map((c) =>
          connectionProfiles.find(
            (p) =>
              p.id ===
              (c.sender_id === user?.id
                ? c.receiver_id
                : c.sender_id)
          )
        )
        .filter(Boolean),
    [acceptedConnections, connectionProfiles, user?.id]
  );

  function openPage(item) {
    setPage(item);
    setMoreOpen(false);

    if (item !== "Messenger") {
      setSelectedChat(null);
    }
  }

  function Avatar({ src, name, size = 42 }) {
    const fallback =
      "https://ui-avatars.com/api/?name=" +
      encodeURIComponent(name || "User") +
      "&background=243047&color=fff";

    return (
      <img
        className="gc-avatar"
        src={src || fallback}
        alt=""
        style={{ width: size, height: size }}
      />
    );
  }

  function PersonCard({ person }) {
    const relation = relationFor(person.id);

    const incoming =
      relation?.receiver_id === user.id &&
      relation?.status === "pending";

    const outgoing =
      relation?.sender_id === user.id &&
      relation?.status === "pending";

    const accepted = relation?.status === "accepted";

    return (
      <article className="gc-person-card">
        <Avatar
          src={person.avatar_url}
          name={person.display_name}
          size={54}
        />

        <div className="gc-person-info">
          <strong>
            {person.display_name || "Community member"}
          </strong>
          <p>
            {person.bio ||
              "I love meeting new people and connecting with the world. 🌍"}
          </p>
        </div>

        {accepted ? (
          <span className="gc-status">Connected</span>
        ) : incoming ? (
          <div className="gc-actions">
            <button
              disabled={connectionAction === relation.id}
              onClick={() =>
                respondToConnection(relation.id, "accepted")
              }
            >
              Accept
            </button>

            <button
              className="secondary-btn"
              disabled={connectionAction === relation.id}
              onClick={() =>
                respondToConnection(relation.id, "rejected")
              }
            >
              Reject
            </button>
          </div>
        ) : outgoing ? (
          <span className="gc-status">Request Sent</span>
        ) : (
          <button
            disabled={connectionAction === person.id}
            onClick={() => sendConnectionRequest(person.id)}
          >
            {connectionAction === person.id
              ? "Sending..."
              : "Connect"}
          </button>
        )}
      </article>
    );
  }

  function PostCard({ post }) {
    const mediaUrl =
      post.media_url || post.image_url || post.file_url;

    const isVideo =
      post.media_type === "video" ||
      (mediaUrl &&
        /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl));

    return (
      <article className="gc-post-card">
        <div className="gc-post-head">
          <Avatar
            src={post.author_avatar}
            name={post.author_name}
          />

          <div className="gc-post-author">
            <strong>{post.author_name}</strong>
            <small>
              {post.created_at
                ? new Date(post.created_at).toLocaleString()
                : ""}
            </small>
          </div>

          {(post.author_id === user.id ||
            post.user_id === user.id) && (
            <button
              className="gc-delete"
              disabled={deletingPost === post.id}
              onClick={() => deletePost(post)}
            >
              Delete
            </button>
          )}
        </div>

        {post.content && (
          <p className="gc-post-text">{post.content}</p>
        )}

        {mediaUrl &&
          (isVideo ? (
            <video
              className="gc-post-media"
              src={mediaUrl}
              controls
              playsInline
            />
          ) : (
            <img
              className="gc-post-media"
              src={mediaUrl}
              alt="Post media"
            />
          ))}
      </article>
    );
  }

  if (checking) {
    return (
      <div className="gc-loading">
        <div className="gc-spinner" />
        <h2>GLOBAL CONNECT</h2>
        <p>Loading your world...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Auth onLogin={setUser} />
        {notice && <div className="gc-toast">{notice}</div>}
      </>
    );
  }

  return (
    <div className="gc-app">
      <style>{`
        .gc-app{min-height:100vh;background:#090d1c;color:#f8fafc;display:flex;font-family:Inter,Arial,sans-serif}
        .gc-sidebar{width:245px;flex-shrink:0;background:#101827;border-right:1px solid #253149;padding:24px 14px;position:sticky;top:0;height:100vh;overflow:auto}
        .gc-brand{font-size:20px;font-weight:900;letter-spacing:1px;padding:4px 12px 28px}
        .gc-brand span{display:block;color:#7dd3fc;font-size:11px;letter-spacing:3px;margin-top:5px}
        .gc-nav{display:grid;gap:7px}
        .gc-nav button,.gc-mobile-nav button,.gc-more-menu button{border:0;background:transparent;color:#aab6ca;text-align:left;padding:12px;border-radius:11px;font-size:14px;cursor:pointer}
        .gc-nav button.active,.gc-nav button:hover,.gc-mobile-nav button.active{background:#1d2b43;color:#fff}
        .gc-main{min-width:0;flex:1}
        .gc-topbar{height:72px;border-bottom:1px solid #202c40;display:flex;align-items:center;justify-content:space-between;padding:0 28px;background:#0d1424;position:sticky;top:0;z-index:5}
        .gc-top-actions{display:flex;gap:10px;align-items:center}
        .gc-icon-btn{border:1px solid #2b3850;background:#172238;color:#fff;border-radius:12px;padding:10px 13px;cursor:pointer}
        .gc-content{max-width:1100px;margin:0 auto;padding:28px 26px 100px}
        .gc-hero{padding:34px;border:1px solid #2a3b58;border-radius:22px;background:linear-gradient(120deg,#152844,#101827 65%,#1b2440);margin-bottom:22px}
        .gc-hero h1{font-size:clamp(28px,5vw,44px);margin:0 0 10px}
        .gc-hero p,.gc-muted{color:#aab6ca;line-height:1.6}
        .gc-panel{background:#111b2d;border:1px solid #25344c;border-radius:18px;padding:22px;margin-bottom:20px}
        .gc-panel h2{margin:0 0 8px;font-size:21px}
        .gc-panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}
        .gc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
        .gc-feature{background:#111b2d;border:1px solid #25344c;border-radius:16px;padding:20px;cursor:pointer;text-align:left;color:#fff}
        .gc-feature b{display:block;margin:8px 0}
        .gc-feature span{color:#9eabc0;font-size:13px;line-height:1.5}
        .gc-field{width:100%;background:#0b1322;border:1px solid #33435e;color:#fff;border-radius:11px;padding:13px;font:inherit;outline:none}
        .gc-field:focus{border-color:#38bdf8}
        .gc-form{display:grid;gap:12px}
        .gc-btn,.gc-person-card button,.gc-actions button{background:#0284c7;color:#fff;border:0;border-radius:10px;padding:11px 16px;font-weight:700;cursor:pointer}
        .gc-btn:disabled,.gc-person-card button:disabled{opacity:.55;cursor:not-allowed}
        .secondary-btn{background:#26354d!important;color:#dbeafe!important}
        .gc-post-card{background:#111b2d;border:1px solid #25344c;border-radius:17px;padding:18px;margin-bottom:15px}
        .gc-post-head{display:flex;align-items:center;gap:12px}
        .gc-avatar{border-radius:50%;object-fit:cover;background:#243047;flex-shrink:0}
        .gc-post-author{display:grid;gap:4px;flex:1}
        .gc-post-author small{color:#8392aa;font-size:11px}
        .gc-post-text{white-space:pre-wrap;line-height:1.6;margin:16px 0}
        .gc-post-media{width:100%;max-height:520px;object-fit:contain;background:#070b14;border-radius:12px;margin-top:12px}
        .gc-delete{background:transparent;color:#fca5a5;border:0;cursor:pointer}
        .gc-person-card{display:flex;align-items:center;gap:13px;background:#111b2d;border:1px solid #25344c;border-radius:15px;padding:15px;margin-bottom:12px}
        .gc-person-info{flex:1;min-width:0}
        .gc-person-info p{font-size:13px;color:#9eabc0;margin:5px 0 0;line-height:1.45}
        .gc-status{font-size:12px;color:#93c5fd;white-space:nowrap}
        .gc-actions{display:flex;gap:6px}
        .gc-chat-layout{display:grid;grid-template-columns:260px minmax(0,1fr);gap:14px;min-height:480px}
        .gc-chat-list,.gc-chat-window{background:#111b2d;border:1px solid #25344c;border-radius:16px;padding:14px;min-width:0}
        .gc-chat-person{width:100%;display:flex;align-items:center;gap:10px;background:transparent;border:0;color:#fff;padding:10px;border-radius:10px;text-align:left;cursor:pointer}
        .gc-chat-person.selected{background:#24344e}
        .gc-messages{height:360px;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:10px 0}
        .gc-bubble{max-width:80%;padding:11px 13px;border-radius:14px;background:#26354d;align-self:flex-start;overflow-wrap:anywhere}
        .gc-bubble.mine{background:#075985;align-self:flex-end}
        .gc-bubble small{display:block;color:#c3d7e8;font-size:10px;margin-top:5px}
        .gc-chat-form{display:flex;gap:8px}
        .gc-chat-form .gc-field{min-width:0}
        .gc-cover{height:150px;border-radius:13px;background:#1e3a5f center/cover no-repeat;margin-bottom:18px}
        .gc-profile-row{display:flex;align-items:center;gap:14px;margin-top:-48px;padding:0 18px 14px}
        .gc-profile-row .gc-avatar{border:4px solid #111b2d}
        .gc-toast{position:fixed;bottom:22px;right:22px;z-index:20;background:#172943;border:1px solid #426080;color:#fff;padding:13px 18px;border-radius:12px;max-width:min(90vw,420px);box-shadow:0 12px 35px #0008}
        .gc-empty{padding:28px;text-align:center;color:#9eabc0}
        .gc-loading,.error-screen{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#090d1c;color:#fff;text-align:center;padding:20px}
        .gc-spinner{width:34px;height:34px;border:3px solid #334155;border-top-color:#38bdf8;border-radius:50%;animation:gcspin 1s linear infinite;margin-bottom:15px}
        @keyframes gcspin{to{transform:rotate(360deg)}}
        .gc-mobile-nav,.gc-more-menu{display:none}
        @media(max-width:850px){.gc-sidebar{width:205px}.gc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:680px){
          .gc-app{display:block}
          .gc-sidebar{display:none}
          .gc-topbar{height:62px;padding:0 14px}
          .gc-content{padding:18px 13px 100px}
          .gc-hero{padding:23px}
          .gc-panel{padding:16px}
          .gc-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
          .gc-feature{padding:14px}
          .gc-person-card{align-items:flex-start;flex-wrap:wrap}
          .gc-person-info{min-width:calc(100% - 75px)}
          .gc-person-card>button,.gc-person-card>.gc-status,.gc-person-card>.gc-actions{margin-left:67px}
          .gc-chat-layout{grid-template-columns:1fr}
          .gc-chat-list{max-height:180px;overflow:auto}
          .gc-messages{height:300px}
          .gc-mobile-nav{display:flex;position:fixed;bottom:0;left:0;right:0;z-index:10;background:#101827;border-top:1px solid #2b3850;justify-content:space-around;padding:7px 2px calc(7px + env(safe-area-inset-bottom))}
          .gc-mobile-nav button{font-size:10px;text-align:center;padding:8px 5px;flex:1}
          .gc-more-menu{display:block;position:fixed;right:12px;bottom:75px;z-index:12;background:#172238;border:1px solid #35445d;border-radius:14px;padding:8px;max-height:65vh;overflow:auto;box-shadow:0 15px 40px #0009}
          .gc-more-menu button{display:block;width:100%}
          .gc-toast{bottom:78px;left:12px;right:12px;max-width:none}
          .gc-profile-row{padding-left:8px}
        }
      `}</style>

      <aside className="gc-sidebar">
        <div className="gc-brand">
          🌍 GLOBAL CONNECT
          <span>MEET THE WORLD</span>
        </div>

        <nav className="gc-nav">
          {menuItems.map((item) => (
            <button
              key={item}
              className={page === item ? "active" : ""}
              onClick={() => openPage(item)}
            >
              {item === "Home" ? "⌂" :
                item === "Social Feed" ? "▤" :
                item === "Random Video" ? "◉" :
                item === "Random Audio" ? "♫" :
                item === "Random Chat" ? "☏" :
                item === "Messenger" ? "✉" :
                item === "Discover" ? "◎" :
                item === "Connections" ? "♧" :
                item === "Reels" ? "▶" :
                item === "Live Rooms" ? "●" :
                item === "Profile" ? "◉" : "♢"}
              {"　"}{item}
            </button>
          ))}
        </nav>
      </aside>

      <main className="gc-main">
        <header className="gc-topbar">
          <strong>{page}</strong>

          <div className="gc-top-actions">
            <button
              className="gc-icon-btn"
              onClick={() => openPage("Discover")}
            >
              🔍
            </button>

            <button
              className="gc-icon-btn"
              onClick={() => openPage("Notifications")}
            >
              🔔
            </button>

            <button
              className="gc-icon-btn"
              onClick={() => openPage("Profile")}
            >
              <Avatar
                src={profile.avatar_url}
                name={displayName}
                size={24}
              />
            </button>

            <button className="gc-icon-btn" onClick={logout}>
              ↪
            </button>
          </div>
        </header>

        <div className="gc-content">

          {page === "Home" && (
            <>
              <section className="gc-hero">
                <h1>Meet the world. 🌍</h1>
                <p>
                  Connect with people, share your moments and build
                  meaningful friendships around the world.
                </p>

                <button
                  className="gc-btn"
                  onClick={() => openPage("Discover")}
                >
                  Discover People
                </button>
              </section>

              <div className="gc-grid">
                {[
                  ["🌍", "Discover People", "Find new connections around the world.", "Discover"],
                  ["📰", "Social Feed", "Share photos, videos and moments.", "Social Feed"],
                  ["💬", "Messenger", "Chat privately with your connections.", "Messenger"],
                  ["🎥", "Random Video", "Video matching interface.", "Random Video"],
                  ["🎙️", "Random Audio", "Audio matching interface.", "Random Audio"],
                  ["🔴", "Live Rooms", "Live rooms and group streaming.", "Live Rooms"]
                ].map(([icon, title, desc, target]) => (
                  <button
                    className="gc-feature"
                    key={title}
                    onClick={() => openPage(target)}
                  >
                    <div style={{ fontSize: 28 }}>{icon}</div>
                    <b>{title}</b>
                    <span>{desc}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {page === "Social Feed" && (
            <>
              <section className="gc-panel">
                <h2>Global Social Feed</h2>
                <p className="gc-muted">
                  Share your moments with the world 🌍
                </p>

                <form className="gc-form" onSubmit={createPost}>
                  <textarea
                    className="gc-field"
                    rows="3"
                    maxLength="2000"
                    placeholder="What's on your mind?"
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                  />

                  <input
                    id="post-file-input"
                    className="gc-field"
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) =>
                      setPostFile(e.target.files?.[0] || null)
                    }
                  />

                  {postFile && (
                    <small className="gc-muted">
                      Selected: {postFile.name}
                    </small>
                  )}

                  <button className="gc-btn" disabled={posting}>
                    {posting ? "Publishing..." : "🌍 Publish Post"}
                  </button>
                </form>
              </section>

              <section>
                <div className="gc-panel-head">
                  <h2>Community Posts</h2>
                  <button className="gc-icon-btn" onClick={loadPosts}>
                    ↻ Refresh
                  </button>
                </div>

                {loadingPosts ? (
                  <div className="gc-empty">Loading posts...</div>
                ) : posts.length ? (
                  posts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))
                ) : (
                  <div className="gc-panel gc-empty">
                    📰 No posts yet. Be the first person to share
                    something with the community!
                  </div>
                )}
              </section>
            </>
          )}

          {page === "Discover" && (
            <section className="gc-panel">
              <div className="gc-panel-head">
                <div>
                  <h2>Discover People</h2>
                  <p className="gc-muted">
                    Find new connections around the world. 🌍
                  </p>
                </div>

                <button className="gc-icon-btn" onClick={loadPeople}>
                  ↻ Refresh
                </button>
              </div>

              {loadingPeople ? (
                <div className="gc-empty">Loading people...</div>
              ) : people.length ? (
                people.map((person) => (
                  <PersonCard key={person.id} person={person} />
                ))
              ) : (
                <div className="gc-empty">
                  अभी कोई दूसरा community member नहीं मिला।
                </div>
              )}
            </section>
          )}

          {page === "Connections" && (
            <section className="gc-panel">
              <div className="gc-panel-head">
                <div>
                  <h2>Connections</h2>
                  <p className="gc-muted">
                    Manage your connection requests and friends.
                  </p>
                </div>

                <button
                  className="gc-icon-btn"
                  onClick={loadConnections}
                >
                  ↻ Refresh
                </button>
              </div>

              <h3 style={{ margin: "15px 0" }}>
                Incoming Requests
              </h3>

              {incomingRequests.length ? (
                incomingRequests.map((connection) => {
                  const person =
                    connectionProfiles.find(
                      (p) => p.id === connection.sender_id
                    ) || {
                      id: connection.sender_id,
                      display_name: "Community member"
                    };

                  return (
                    <PersonCard
                      key={connection.id}
                      person={person}
                    />
                  );
                })
              ) : (
                <p className="gc-empty">No pending requests.</p>
              )}

              <h3 style={{ margin: "24px 0 14px" }}>
                Your Connections
              </h3>

              {connectedPeople.length ? (
                connectedPeople.map((person) => (
                  <div className="gc-person-card" key={person.id}>
                    <Avatar
                      src={person.avatar_url}
                      name={person.display_name}
                    />

                    <div className="gc-person-info">
                      <strong>
                        {person.display_name || "Community member"}
                      </strong>
                      <p>{person.bio || "Connected with you"}</p>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedChat(person);
                        setPage("Messenger");
                      }}
                    >
                      Message
                    </button>
                  </div>
                ))
              ) : (
                <p className="gc-empty">
                  No connections yet. Discover people to connect.
                </p>
              )}
            </section>
          )}

          {page === "Messenger" && (
            <section>
              <div className="gc-panel-head">
                <div>
                  <h2>Messenger</h2>
                  <p className="gc-muted">
                    Private messages with your connections.
                  </p>
                </div>

                <button
                  className="gc-icon-btn"
                  onClick={loadConnections}
                >
                  ↻ Refresh
                </button>
              </div>

              <div className="gc-chat-layout">
                <div className="gc-chat-list">
                  <strong>Your Connections</strong>

                  {connectedPeople.length ? (
                    connectedPeople.map((person) => (
                      <button
                        key={person.id}
                        className={
                          "gc-chat-person " +
                          (selectedChat?.id === person.id
                            ? "selected"
                            : "")
                        }
                        onClick={() => setSelectedChat(person)}
                      >
                        <Avatar
                          src={person.avatar_url}
                          name={person.display_name}
                          size={34}
                        />
                        <span>
                          {person.display_name || "Member"}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="gc-empty">
                      Connect with people first.
                    </p>
                  )}
                </div>

                <div className="gc-chat-window">
                  {selectedChat ? (
                    <>
                      <strong>
                        Chat with {selectedChat.display_name || "Member"}
                      </strong>

                      <div className="gc-messages">
                        {loadingMessages ? (
                          <p className="gc-empty">
                            Loading messages...
                          </p>
                        ) : messages.length ? (
                          messages.map((message) => (
                            <div
                              key={message.id}
                              className={
                                "gc-bubble " +
                                (message.sender_id === user.id
                                  ? "mine"
                                  : "")
                              }
                            >
                              {message.content}
                              <small>
                                {message.created_at
                                  ? new Date(
                                      message.created_at
                                    ).toLocaleTimeString()
                                  : ""}
                                {message.sender_id === user.id &&
                                  message.read_at
                                  ? " · Seen"
                                  : ""}
                              </small>
                            </div>
                          ))
                        ) : (
                          <p className="gc-empty">
                            Say hello and start the conversation.
                          </p>
                        )}
                      </div>

                      <form
                        className="gc-chat-form"
                        onSubmit={sendMessage}
                      >
                        <input
                          className="gc-field"
                          placeholder="Type a message..."
                          value={messageText}
                          onChange={(e) =>
                            setMessageText(e.target.value)
                          }
                        />

                        <button
                          className="gc-btn"
                          disabled={sendingMessage}
                        >
                          {sendingMessage ? "..." : "Send"}
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="gc-empty">
                      Select a connection to start messaging.
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {page === "Profile" && (
            <section className="gc-panel">
              <h2>Your Profile</h2>

              <div
                className="gc-cover"
                style={{
                  backgroundImage: profile.cover_url
                    ? `url("${profile.cover_url}")`
                    : undefined
                }}
              />

              <div className="gc-profile-row">
                <Avatar
                  src={profile.avatar_url}
                  name={displayName}
                  size={76}
                />

                <div>
                  <strong>{displayName}</strong>
                  <p className="gc-muted">{user.email}</p>
                </div>
              </div>

              <form className="gc-form" onSubmit={saveProfile}>
                <label>
                  Display Name
                  <input
                    className="gc-field"
                    maxLength="60"
                    value={profile.display_name}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        display_name: e.target.value
                      }))
                    }
                    placeholder="Your name"
                  />
                </label>

                <label>
                  About You
                  <textarea
                    className="gc-field"
                    rows="4"
                    maxLength="500"
                    value={profile.bio}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        bio: e.target.value
                      }))
                    }
                    placeholder="Tell the world about yourself..."
                  />
                </label>

                <label>
                  Profile Photo
                  <input
                    className="gc-field"
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      uploadProfileImage(
                        e.target.files?.[0],
                        "avatar_url"
                      )
                    }
                  />
                </label>

                <label>
                  Cover Photo
                  <input
                    className="gc-field"
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      uploadProfileImage(
                        e.target.files?.[0],
                        "cover_url"
                      )
                    }
                  />
                </label>

                <button className="gc-btn" disabled={busy}>
                  {busy ? "Saving..." : "Save Profile"}
                </button>
              </form>
            </section>
          )}

          {page === "Reels" && (
            <section className="gc-panel">
              <h2>Reels</h2>
              <p className="gc-muted">
                Short videos shared by the community.
              </p>

              {posts.filter(
                (p) =>
                  p.media_type === "video" ||
                  /\.(mp4|webm|mov)(\?|$)/i.test(
                    p.media_url || ""
                  )
              ).length ? (
                posts
                  .filter(
                    (p) =>
                      p.media_type === "video" ||
                      /\.(mp4|webm|mov)(\?|$)/i.test(
                        p.media_url || ""
                      )
                  )
                  .map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))
              ) : (
                <div className="gc-empty">
                  No reels yet. Share a video in Social Feed to get
                  started.
                </div>
              )}
            </section>
          )}

          {[
            "Random Video",
            "Random Audio",
            "Random Chat",
            "Live Rooms"
          ].includes(page) && (
            <section className="gc-panel">
              <div style={{ fontSize: 42, marginBottom: 12 }}>
                {page === "Random Video"
                  ? "🎥"
                  : page === "Random Audio"
                  ? "🎙️"
                  : page === "Random Chat"
                  ? "💬"
                  : "🔴"}
              </div>

              <h2>{page}</h2>

              <p
                className="gc-muted"
                style={{ margin: "12px 0 20px" }}
              >
                {page === "Random Video"
                  ? "Random video matching के लिए WebRTC signaling और matching server जोड़ना बाकी है।"
                  : page === "Random Audio"
                  ? "Audio calls के लिए WebRTC signaling और matching server जोड़ना बाकी है।"
                  : page === "Random Chat"
                  ? "Random text matching service अभी connect नहीं है।"
                  : "Live multi-user rooms के लिए streaming server/SFU जोड़ना बाकी है।"}
              </p>

              <button
                className="gc-btn"
                onClick={() =>
                  showNotice(
                    "यह feature UI तैयार है; अगला चरण backend और realtime calling setup है।"
                  )
                }
              >
                Check Feature Status
              </button>
            </section>
          )}

          {page === "Notifications" && (
            <section className="gc-panel">
              <h2>Notifications</h2>
              <p className="gc-muted">
                Your connection and activity notifications will appear here.
              </p>
              <div className="gc-empty">
                No new notifications.
              </div>
            </section>
          )}

        </div>
      </main>

      <nav className="gc-mobile-nav">
        {mobileItems.map((item) => (
          <button
            key={item}
            className={page === item ? "active" : ""}
            onClick={() => openPage(item)}
          >
            {item === "Home" ? "⌂" :
              item === "Social Feed" ? "▤" :
              item === "Discover" ? "◎" :
              item === "Messenger" ? "✉" : "◉"}
            <br />
            {item}
          </button>
        ))}

        <button onClick={() => setMoreOpen((v) => !v)}>
          ☰
          <br />
          More
        </button>
      </nav>

      {moreOpen && (
        <div className="gc-more-menu">
          {menuItems
            .filter((item) => !mobileItems.includes(item))
            .map((item) => (
              <button
                key={item}
                onClick={() => openPage(item)}
              >
                {item}
              </button>
            ))}
        </div>
      )}

      {notice && (
        <div className="gc-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
