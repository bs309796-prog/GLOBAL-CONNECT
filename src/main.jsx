import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Auth from "./Auth.jsx";
import { supabase } from "./supabase.js";
import "./style.css";
import {
  Home, Compass, Users, User, MessageCircle, Bell, Video, Radio,
  Image, Heart, MessageSquare, Send, Plus, Search, Settings, LogOut,
  Menu, X, MoreHorizontal, Camera, Mic, Phone, PhoneCall, Smile,
  Bookmark, Share2, Trash2, Check, CheckCheck, RefreshCw, Play,
  Film, Headphones, Globe, UserPlus, UserCheck, ArrowLeft, Upload,
  Edit3, Shield, Volume2, Wifi, CircleDot, Clock, Eye, ChevronDown
} from "lucide-react";

const BUCKET_POST = "post-media";
const BUCKET_PROFILE = "profile-media";
const MAX_POST_SIZE = 50 * 1024 * 1024;
const MAX_PROFILE_SIZE = 5 * 1024 * 1024;

const TABLES = {
  profiles: "profiles",
  posts: "posts",
  connections: "connections",
  messages: "messages",
  likes: "post_likes",
  comments: "post_comments",
  stories: "stories",
  notifications: "notifications",
  rooms: "live_rooms",
  participants: "live_room_participants",
  queue: "random_chat_queue",
  signals: "call_signals"
};

const NAV = [
  ["Home", Home],
  ["Social Feed", Image],
  ["Stories", CircleDot],
  ["Reels", Film],
  ["Discover", Compass],
  ["Connections", Users],
  ["Messenger", MessageCircle],
  ["Random Chat", Globe],
  ["Random Video", Video],
  ["Random Audio", Headphones],
  ["Live Rooms", Radio],
  ["Notifications", Bell],
  ["Profile", User],
  ["Settings", Settings]
];

const timeAgo = (value) => {
  if (!value) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const initials = (name = "User") =>
  name.trim().split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase()).join("");

function Avatar({ src, name, size = 42, online = false }) {
  return (
    <span className="gc-avatar-wrap" style={{ width: size, height: size }}>
      {src
        ? <img className="gc-avatar" src={src} alt={name || "Profile"} />
        : <span className="gc-avatar gc-avatar-fallback">{initials(name)}</span>}
      {online && <i className="gc-online-dot" />}
    </span>
  );
}

function ErrorBoundary({ children }) {
  const [error, setError] = useState("");
  if (error) {
    return (
      <div className="gc-error">
        <h2>GLOBAL CONNECT</h2>
        <p>Something went wrong.</p>
        <pre>{error}</pre>
        <button onClick={() => window.location.reload()}>Reload App</button>
      </div>
    );
  }
  return (
    <ErrorCatcher onError={setError}>
      {children}
    </ErrorCatcher>
  );
}

class ErrorCatcher extends React.Component {
  componentDidCatch(error) {
    this.props.onError(error?.message || "Unknown application error");
  }
  render() {
    return this.props.children;
  }
}

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState("Home");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [posts, setPosts] = useState([]);
  const [connections, setConnections] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [stories, setStories] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [selectedStory, setSelectedStory] = useState(null);
  const [search, setSearch] = useState("");
  const [messageText, setMessageText] = useState("");
  const [postText, setPostText] = useState("");
  const [commentText, setCommentText] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [comments, setComments] = useState({});
  const [likedPosts, setLikedPosts] = useState({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [profileEdit, setProfileEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [roomTitle, setRoomTitle] = useState("");
  const [activeRoom, setActiveRoom] = useState(null);
  const [callState, setCallState] = useState("idle");
  const [callMode, setCallMode] = useState("video");
  const [callPeer, setCallPeer] = useState(null);
  const [randomStatus, setRandomStatus] = useState("idle");
  const [randomPartner, setRandomPartner] = useState(null);
  const [settings, setSettings] = useState({ private: false, notifications: true });
  const filePostRef = useRef(null);
  const fileStoryRef = useRef(null);
  const fileAvatarRef = useRef(null);
  const fileCoverRef = useRef(null);
  const chatEndRef = useRef(null);
  const realtimeRef = useRef([]);

  const user = session?.user || null;
  const userId = user?.id;

  const flash = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) flash(error.message);
      setSession(data?.session || null);
      setAuthLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });
    return () => {
      mounted = false;
      data?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadEverything();
    return () => {
      realtimeRef.current.forEach(channel => {
        try { supabase.removeChannel(channel); } catch {}
      });
      realtimeRef.current = [];
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(`global-connect-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, loadPosts)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, loadChats)
      .on("postgres_changes", { event: "*", schema: "public", table: "connections" }, loadConnections)
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, loadStories)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, loadNotifications)
      .subscribe();
    realtimeRef.current.push(channel);
    return () => {
      supabase.removeChannel(channel);
      realtimeRef.current = realtimeRef.current.filter(x => x !== channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !selectedChat?.id) return;
    loadMessages(selectedChat.id);
    const channel = supabase.channel(`messages-${userId}-${selectedChat.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, payload => {
        const row = payload.new || payload.old;
        if (row && (
          (row.sender_id === userId && row.receiver_id === selectedChat.id) ||
          (row.sender_id === selectedChat.id && row.receiver_id === userId)
        )) loadMessages(selectedChat.id);
      }).subscribe();
    realtimeRef.current.push(channel);
    return () => {
      supabase.removeChannel(channel);
      realtimeRef.current = realtimeRef.current.filter(x => x !== channel);
    };
  }, [userId, selectedChat?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadEverything() {
    await Promise.all([
      loadProfile(), loadPosts(), loadConnections(), loadChats(),
      loadStories(), loadNotifications(), loadRooms(), loadDiscover()
    ]);
  }

  async function loadProfile() {
    if (!userId) return;
    const { data, error } = await supabase.from(TABLES.profiles)
      .select("*").eq("id", userId).maybeSingle();
    if (error) {
      console.error(error);
      return;
    }
    if (data) {
      setProfile(data);
      setEditName(data.display_name || "");
      setEditBio(data.bio || "");
    } else {
      const fallback = {
        id: userId,
        display_name: user.email?.split("@")[0] || "New User",
        bio: "",
        avatar_url: null,
        cover_url: null
      };
      setProfile(fallback);
      setEditName(fallback.display_name);
    }
  }

  async function loadPosts() {
    const { data, error } = await supabase.from(TABLES.posts)
      .select("*").order("created_at", { ascending: false }).limit(100);
    if (error) {
      console.error("Posts:", error.message);
      return;
    }
    const rows = data || [];
    setPosts(rows);
    if (userId && rows.length) {
      const ids = rows.map(p => p.id);
      const { data: liked } = await supabase.from(TABLES.likes)
        .select("post_id").eq("user_id", userId).in("post_id", ids);
      setLikedPosts(Object.fromEntries((liked || []).map(x => [x.post_id, true])));
    }
  }

  async function loadDiscover() {
    if (!userId) return;
    const { data, error } = await supabase.from(TABLES.profiles)
      .select("*").neq("id", userId).order("updated_at", { ascending: false }).limit(100);
    if (!error) setProfiles(data || []);
    else console.error("Discover:", error.message);
  }

  async function loadConnections() {
    if (!userId) return;
    const { data, error } = await supabase.from(TABLES.connections)
      .select("*")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Connections:", error.message);
      return;
    }
    const rows = data || [];
    setConnections(rows);
    const ids = [...new Set(rows.map(r => r.sender_id === userId ? r.receiver_id : r.sender_id))];
    if (ids.length) {
      const { data: people } = await supabase.from(TABLES.profiles).select("*").in("id", ids);
      setChats(people || []);
    } else {
      setChats([]);
    }
  }

  async function loadChats() {
    if (!userId) return;
    const { data, error } = await supabase.from(TABLES.messages)
      .select("*")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false }).limit(200);
    if (error) {
      console.error("Messages:", error.message);
      return;
    }
    const rows = data || [];
    const ids = [...new Set(rows.map(m => m.sender_id === userId ? m.receiver_id : m.sender_id))];
    if (ids.length) {
      const { data: people } = await supabase.from(TABLES.profiles).select("*").in("id", ids);
      const map = Object.fromEntries((people || []).map(p => [p.id, p]));
      setChats(prev => {
        const merged = new Map(prev.map(p => [p.id, p]));
        Object.values(map).forEach(p => merged.set(p.id, p));
        return [...merged.values()];
      });
    }
  }

  async function loadMessages(otherId) {
    if (!userId || !otherId) return;
    const { data, error } = await supabase.from(TABLES.messages)
      .select("*")
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`
      )
      .order("created_at", { ascending: true }).limit(300);
    if (error) {
      flash(`Messages load नहीं हुए: ${error.message}`);
      return;
    }
    setMessages(data || []);
    await supabase.from(TABLES.messages).update({ read_at: new Date().toISOString() })
      .eq("sender_id", otherId).eq("receiver_id", userId).is("read_at", null);
  }

  async function loadStories() {
    const { data, error } = await supabase.from(TABLES.stories)
      .select("*").gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(100);
    if (!error) setStories(data || []);
    else console.error("Stories:", error.message);
  }

  async function loadNotifications() {
    if (!userId) return;
    const { data, error } = await supabase.from(TABLES.notifications)
      .select("*").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(50);
    if (!error) setNotifications(data || []);
    else console.error("Notifications:", error.message);
  }

  async function loadRooms() {
    const { data, error } = await supabase.from(TABLES.rooms)
      .select("*").eq("status", "live")
      .order("created_at", { ascending: false }).limit(50);
    if (!error) setRooms(data || []);
    else console.error("Live rooms:", error.message);
  }

  async function uploadFile(file, bucket, maxSize) {
    if (!file) return null;
    if (file.size > maxSize) {
      flash(`File size ${Math.round(maxSize / 1024 / 1024)}MB से कम रखें`);
      return null;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600", upsert: false, contentType: file.type
    });
    if (error) {
      flash(`Upload error: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || null;
  }

  async function createPost(file) {
    if (!postText.trim() && !file) return flash("कुछ लिखें या फोटो/वीडियो चुनें");
    setBusy(true);
    try {
      let mediaUrl = null;
      let mediaType = null;
      if (file) {
        mediaUrl = await uploadFile(file, BUCKET_POST, MAX_POST_SIZE);
        if (!mediaUrl) return;
        mediaType = file.type.startsWith("video/") ? "video" : "image";
      }
      const { error } = await supabase.from(TABLES.posts).insert({
        user_id: userId,
        content: postText.trim(),
        media_url: mediaUrl,
        media_type: mediaType
      });
      if (error) throw error;
      setPostText("");
      if (filePostRef.current) filePostRef.current.value = "";
      await loadPosts();
      flash("Post publish हो गई!");
    } catch (e) {
      flash(`Post error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function deletePost(post) {
    if (!window.confirm("क्या आप यह पोस्ट delete करना चाहते हैं?")) return;
    const { error } = await supabase.from(TABLES.posts)
      .delete().eq("id", post.id).eq("user_id", userId);
    if (error) flash(error.message);
    else {
      setPosts(prev => prev.filter(p => p.id !== post.id));
      flash("Post deleted");
    }
  }

  async function toggleLike(post) {
    const wasLiked = !!likedPosts[post.id];
    setLikedPosts(prev => ({ ...prev, [post.id]: !wasLiked }));
    if (wasLiked) {
      const { error } = await supabase.from(TABLES.likes)
        .delete().eq("post_id", post.id).eq("user_id", userId);
      if (error) {
        setLikedPosts(prev => ({ ...prev, [post.id]: true }));
        flash(error.message);
      }
    } else {
      const { error } = await supabase.from(TABLES.likes)
        .insert({ post_id: post.id, user_id: userId });
      if (error) {
        setLikedPosts(prev => ({ ...prev, [post.id]: false }));
        flash(error.message);
      }
    }
  }

  async function loadComments(postId) {
    const { data, error } = await supabase.from(TABLES.comments)
      .select("*").eq("post_id", postId)
      .order("created_at", { ascending: true }).limit(100);
    if (error) return flash(`Comments: ${error.message}`);
    const rows = data || [];
    const ids = [...new Set(rows.map(c => c.user_id))];
    let people = [];
    if (ids.length) {
      const result = await supabase.from(TABLES.profiles).select("*").in("id", ids);
      people = result.data || [];
    }
    const map = Object.fromEntries(people.map(p => [p.id, p]));
    setComments(prev => ({
      ...prev,
      [postId]: rows.map(c => ({ ...c, author: map[c.user_id] }))
    }));
  }

  async function addComment(postId) {
    const content = (commentText[postId] || "").trim();
    if (!content) return;
    const { error } = await supabase.from(TABLES.comments).insert({
      post_id: postId, user_id: userId, content
    });
    if (error) return flash(error.message);
    setCommentText(prev => ({ ...prev, [postId]: "" }));
    await loadComments(postId);
    flash("Comment added");
  }

  async function createStory(file) {
    if (!file) return;
    const url = await uploadFile(file, BUCKET_POST, MAX_POST_SIZE);
    if (!url) return;
    const { error } = await supabase.from(TABLES.stories).insert({
      user_id: userId,
      media_url: url,
      media_type: file.type.startsWith("video/") ? "video" : "image",
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
    if (error) flash(`Story error: ${error.message}`);
    else {
      await loadStories();
      flash("Your story is live for 24 hours!");
    }
  }

  async function sendMessage() {
    const content = messageText.trim();
    if (!content || !selectedChat) return;
    setMessageText("");
    const { error } = await supabase.from(TABLES.messages).insert({
      sender_id: userId, receiver_id: selectedChat.id, content
    });
    if (error) {
      setMessageText(content);
      flash(`Message error: ${error.message}`);
    } else {
      await loadMessages(selectedChat.id);
      await loadChats();
    }
  }

  async function sendConnection(person) {
    const existing = connections.find(c =>
      (c.sender_id === userId && c.receiver_id === person.id) ||
      (c.sender_id === person.id && c.receiver_id === userId)
    );
    if (existing) return flash(`Connection status: ${existing.status}`);
    const { error } = await supabase.from(TABLES.connections).insert({
      sender_id: userId, receiver_id: person.id, status: "pending"
    });
    if (error) flash(error.message);
    else {
      flash("Connection request sent!");
      await loadConnections();
    }
  }

  async function updateConnection(connection, status) {
    const { error } = await supabase.from(TABLES.connections)
      .update({ status }).eq("id", connection.id).eq("receiver_id", userId);
    if (error) flash(error.message);
    else {
      flash(status === "accepted" ? "Connection accepted" : "Request rejected");
      await loadConnections();
    }
  }

  async function saveProfile() {
    const payload = {
      id: userId,
      display_name: editName.trim() || "User",
      bio: editBio.trim(),
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from(TABLES.profiles)
      .upsert(payload, { onConflict: "id" });
    if (error) return flash(error.message);
    await loadProfile();
    setProfileEdit(false);
    flash("Profile updated");
  }

  async function uploadProfileImage(file, field) {
    const url = await uploadFile(file, BUCKET_PROFILE, MAX_PROFILE_SIZE);
    if (!url) return;
    const { error } = await supabase.from(TABLES.profiles)
      .upsert({ id: userId, [field]: url, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) flash(error.message);
    else {
      await loadProfile();
      flash("Profile image updated");
    }
  }

  async function createRoom() {
    const title = roomTitle.trim() || `${profile?.display_name || "User"}'s Live Room`;
    const { data, error } = await supabase.from(TABLES.rooms).insert({
      host_id: userId, title, status: "live"
    }).select().single();
    if (error) return flash(`Room error: ${error.message}`);
    setActiveRoom(data);
    setRoomTitle("");
    await loadRooms();
    flash("Live room created");
  }

  async function joinRoom(room) {
    const { error } = await supabase.from(TABLES.participants).upsert({
      room_id: room.id, user_id: userId, joined_at: new Date().toISOString()
    }, { onConflict: "room_id,user_id" });
    if (error) return flash(`Join room: ${error.message}`);
    setActiveRoom(room);
    flash("You joined the room");
  }

  async function leaveRoom() {
    if (!activeRoom) return;
    await supabase.from(TABLES.participants)
      .delete().eq("room_id", activeRoom.id).eq("user_id", userId);
    if (activeRoom.host_id === userId) {
      await supabase.from(TABLES.rooms).update({
        status: "ended", ended_at: new Date().toISOString()
      }).eq("id", activeRoom.id);
    }
    setActiveRoom(null);
    await loadRooms();
  }

  async function startRandomChat(mode) {
    setCallMode(mode);
    setRandomStatus("searching");
    setRandomPartner(null);
    const { error } = await supabase.from(TABLES.queue).upsert({
      user_id: userId, mode, status: "waiting", created_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    if (error) {
      setRandomStatus("idle");
      flash(`Random matching setup needed: ${error.message}`);
      return;
    }
    flash("Searching for someone...");
  }

  async function stopRandomChat() {
    await supabase.from(TABLES.queue).delete().eq("user_id", userId);
    setRandomStatus("idle");
    setRandomPartner(null);
  }

  async function startDirectCall(person, mode) {
    setCallPeer(person);
    setCallMode(mode);
    setCallState("starting");
    flash("Calling setup: WebRTC signaling backend required");
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
  }

  async function markNotificationRead(notification) {
    const { error } = await supabase.from(TABLES.notifications)
      .update({ read: true }).eq("id", notification.id).eq("user_id", userId);
    if (!error) loadNotifications();
  }

  const acceptedConnections = useMemo(
    () => connections.filter(c => c.status === "accepted"), [connections]
  );
  const incomingRequests = useMemo(
    () => connections.filter(c => c.receiver_id === userId && c.status === "pending"), [connections, userId]
  );
  const pendingSent = useMemo(
    () => connections.filter(c => c.sender_id === userId && c.status === "pending"), [connections, userId]
  );
  const filteredPeople = useMemo(() => {
    const q = search.toLowerCase();
    return profiles.filter(p =>
      (p.display_name || "").toLowerCase().includes(q) ||
      (p.bio || "").toLowerCase().includes(q)
    );
  }, [profiles, search]);

  const unreadNotifications = notifications.filter(n => !n.read).length;
  const myPosts = posts.filter(p => p.user_id === userId);
  const videoPosts = posts.filter(p => p.media_type === "video");

  if (authLoading) {
    return <div className="gc-loading"><div className="gc-spinner" /><h2>GLOBAL CONNECT</h2><p>Connecting you to the world...</p></div>;
  }
  if (!session) return <Auth />;

  function PageHeader({ title, subtitle, action }) {
    return (
      <div className="gc-page-header">
        <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
        {action}
      </div>
    );
  }

  function PersonCard({ person }) {
    const relation = connections.find(c =>
      (c.sender_id === userId && c.receiver_id === person.id) ||
      (c.sender_id === person.id && c.receiver_id === userId)
    );
    const isConnected = relation?.status === "accepted";
    return (
      <div className="gc-person-card">
        <Avatar src={person.avatar_url} name={person.display_name} size={54} />
        <div className="gc-person-info">
          <b>{person.display_name || "GLOBAL CONNECT User"}</b>
          <span>{person.bio || "Ready to connect with the world."}</span>
        </div>
        {isConnected
          ? <button className="gc-btn gc-btn-muted" onClick={() => { setSelectedChat(person); setPage("Messenger"); }}><MessageCircle size={16}/> Message</button>
          : relation
            ? <button className="gc-btn gc-btn-muted" disabled>{relation.status === "pending" ? "Request Sent" : relation.status}</button>
            : <button className="gc-btn" onClick={() => sendConnection(person)}><UserPlus size={16}/> Connect</button>}
      </div>
    );
  }

  function PostCard({ post }) {
    const author = post.user_id === userId ? profile : profiles.find(p => p.id === post.user_id);
    const isOpen = !!openComments[post.id];
    return (
      <article className="gc-post">
        <div className="gc-post-top">
          <Avatar src={author?.avatar_url} name={author?.display_name || "User"} />
          <div className="gc-post-author">
            <b>{author?.display_name || "GLOBAL CONNECT User"}</b>
            <span>{timeAgo(post.created_at)}</span>
          </div>
          {post.user_id === userId && (
            <button className="gc-icon-btn" onClick={() => deletePost(post)} title="Delete post"><Trash2 size={17}/></button>
          )}
        </div>
        {post.content && <p className="gc-post-text">{post.content}</p>}
        {post.media_url && (
          <div className="gc-post-media">
            {post.media_type === "video"
              ? <video src={post.media_url} controls playsInline />
              : <img src={post.media_url} alt="Post media" />}
          </div>
        )}
        <div className="gc-post-actions">
          <button className={likedPosts[post.id] ? "gc-action gc-liked" : "gc-action"} onClick={() => toggleLike(post)}>
            <Heart size={19} fill={likedPosts[post.id] ? "currentColor" : "none"}/> {likedPosts[post.id] ? "Liked" : "Like"}
          </button>
          <button className="gc-action" onClick={() => {
            setOpenComments(prev => ({ ...prev, [post.id]: !prev[post.id] }));
            if (!comments[post.id]) loadComments(post.id);
          }}><MessageSquare size={19}/> Comment</button>
          <button className="gc-action" onClick={() => {
            if (navigator.share) navigator.share({ title: "GLOBAL CONNECT", text: post.content || "Check out this post", url: window.location.href }).catch(() => {});
            else flash("Share इस डिवाइस पर उपलब्ध नहीं है");
          }}><Share2 size={18}/> Share</button>
        </div>
        {isOpen && (
          <div className="gc-comments">
            {(comments[post.id] || []).map(c => (
              <div className="gc-comment" key={c.id}>
                <Avatar src={c.author?.avatar_url} name={c.author?.display_name || "User"} size={30}/>
                <div><b>{c.author?.display_name || "User"}</b><p>{c.content}</p></div>
              </div>
            ))}
            <div className="gc-comment-input">
              <input value={commentText[post.id] || ""} onChange={e => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))} placeholder="Write a comment..." onKeyDown={e => e.key === "Enter" && addComment(post.id)} />
              <button className="gc-btn gc-btn-small" onClick={() => addComment(post.id)}><Send size={15}/></button>
            </div>
          </div>
        )}
      </article>
    );
  }

  function Composer() {
    return (
      <div className="gc-composer">
        <div className="gc-composer-row">
          <Avatar src={profile?.avatar_url} name={profile?.display_name} />
          <textarea value={postText} onChange={e => setPostText(e.target.value)} placeholder="What's happening? Share something with the world..." rows={2}/>
        </div>
        <div className="gc-composer-bottom">
          <input ref={filePostRef} type="file" accept="image/*,video/*" hidden onChange={e => createPost(e.target.files?.[0])}/>
          <button className="gc-action" onClick={() => filePostRef.current?.click()}><Image size={18}/> Photo / Video</button>
          <button className="gc-btn" disabled={busy} onClick={() => createPost(null)}>{busy ? "Posting..." : <><Send size={16}/> Publish</>}</button>
        </div>
      </div>
    );
  }

  function StoriesStrip() {
    const storyOwners = [...new Map(stories.map(s => [s.user_id, s])).values()];
    return (
      <div className="gc-stories-strip">
        <button className="gc-story-add" onClick={() => fileStoryRef.current?.click()}>
          <span><Plus size={25}/></span><small>Your Story</small>
        </button>
        <input ref={fileStoryRef} hidden type="file" accept="image/*,video/*" onChange={e => createStory(e.target.files?.[0])}/>
        {storyOwners.map(story => {
          const owner = story.user_id === userId ? profile : profiles.find(p => p.id === story.user_id);
          return (
            <button className="gc-story-item" key={story.id} onClick={() => setSelectedStory(story)}>
              <span className="gc-story-ring"><Avatar src={owner?.avatar_url} name={owner?.display_name || "User"} size={54}/></span>
              <small>{owner?.display_name || "Member"}</small>
            </button>
          );
        })}
      </div>
    );
  }

  function HomePage() {
    return (
      <>
        <PageHeader title={`Welcome, ${profile?.display_name || "Friend"} 👋`} subtitle="Meet people, share moments and explore the world."/>
        <div className="gc-welcome-banner">
          <div><span>🌍 GLOBAL CONNECT</span><h2>Meet the World</h2><p>Your world. Your people. Your stories.</p></div>
          <Globe size={75}/>
        </div>
        <div className="gc-stats-grid">
          <div className="gc-stat"><Users/><b>{acceptedConnections.length}</b><span>Connections</span></div>
          <div className="gc-stat"><Image/><b>{myPosts.length}</b><span>Your Posts</span></div>
          <div className="gc-stat"><MessageCircle/><b>{chats.length}</b><span>People</span></div>
          <div className="gc-stat"><Bell/><b>{unreadNotifications}</b><span>Notifications</span></div>
        </div>
        <PageHeader title="Explore GLOBAL CONNECT" subtitle="Jump into your community."/>
        <div className="gc-feature-grid">
          {[
            ["Social Feed","Share photos, videos and updates",Image],
            ["Discover","Find new people around the world",Compass],
            ["Messenger","Chat privately with connections",MessageCircle],
            ["Live Rooms","Join live community rooms",Radio],
            ["Reels","Watch short videos",Film],
            ["Random Chat","Meet someone new",Globe]
          ].map(([name, desc, Icon]) => (
            <button className="gc-feature-card" key={name} onClick={() => setPage(name)}>
              <Icon size={25}/><b>{name}</b><span>{desc}</span>
            </button>
          ))}
        </div>
        <PageHeader title="Recent Posts"/>
        {posts.slice(0, 3).map(post => <PostCard key={post.id} post={post}/>)}
      </>
    );
  }

  function FeedPage() {
    return (
      <>
        <PageHeader title="Social Feed" subtitle="Share your moments with the world."/>
        <Composer/>
        <StoriesStrip/>
        {posts.length ? posts.map(post => <PostCard key={post.id} post={post}/>) : <div className="gc-empty">No posts yet. Be the first to share something!</div>}
      </>
    );
  }

  function StoriesPage() {
    return (
      <>
        <PageHeader title="Stories" subtitle="Stories disappear after 24 hours." action={<button className="gc-btn" onClick={() => fileStoryRef.current?.click()}><Plus size={16}/> Add Story</button>}/>
        <input ref={fileStoryRef} hidden type="file" accept="image/*,video/*" onChange={e => createStory(e.target.files?.[0])}/>
        <StoriesStrip/>
        <div className="gc-story-grid">
          {stories.map(story => {
            const owner = story.user_id === userId ? profile : profiles.find(p => p.id === story.user_id);
            return <button className="gc-story-tile" key={story.id} onClick={() => setSelectedStory(story)}>
              {story.media_type === "video" ? <video src={story.media_url}/> : <img src={story.media_url}/>}
              <span><Avatar src={owner?.avatar_url} name={owner?.display_name} size={30}/>{owner?.display_name || "Member"}</span>
            </button>;
          })}
        </div>
      </>
    );
  }

  function ReelsPage() {
    return (
      <>
        <PageHeader title="Reels" subtitle="Short videos shared by the community."/>
        <div className="gc-reels-grid">
          {videoPosts.map(post => {
            const author = post.user_id === userId ? profile : profiles.find(p => p.id === post.user_id);
            return <div className="gc-reel" key={post.id}>
              <video src={post.media_url} controls playsInline />
              <div><b>{author?.display_name || "Member"}</b><p>{post.content}</p></div>
            </div>;
          })}
        </div>
        {!videoPosts.length && <div className="gc-empty">No reels yet. Share a video in Social Feed to get started.</div>}
      </>
    );
  }

  function DiscoverPage() {
    return (
      <>
        <PageHeader title="Discover People" subtitle="Find new connections around the world." action={<button className="gc-icon-btn" onClick={loadDiscover}><RefreshCw/></button>}/>
        <div className="gc-search"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people by name or bio..."/></div>
        <div className="gc-people-list">
          {filteredPeople.map(person => <PersonCard key={person.id} person={person}/>)}
        </div>
        {!filteredPeople.length && <div className="gc-empty">No people found.</div>}
      </>
    );
  }

  function ConnectionsPage() {
    const acceptedIds = acceptedConnections.map(c => c.sender_id === userId ? c.receiver_id : c.sender_id);
    const acceptedPeople = profiles.filter(p => acceptedIds.includes(p.id));
    const pendingPeople = profiles.filter(p => incomingRequests.some(c => c.sender_id === p.id));
    return (
      <>
        <PageHeader title="Connections" subtitle="Manage your connection requests and friends." action={<button className="gc-icon-btn" onClick={loadConnections}><RefreshCw/></button>}/>
        <h3 className="gc-section-title">Incoming Requests ({incomingRequests.length})</h3>
        {incomingRequests.map(req => {
          const person = profiles.find(p => p.id === req.sender_id);
          return <div className="gc-person-card" key={req.id}>
            <Avatar src={person?.avatar_url} name={person?.display_name}/>
            <div className="gc-person-info"><b>{person?.display_name || "Member"}</b><span>Wants to connect with you</span></div>
            <button className="gc-btn" onClick={() => updateConnection(req, "accepted")}><Check size={16}/> Accept</button>
            <button className="gc-btn gc-btn-muted" onClick={() => updateConnection(req, "rejected")}>Reject</button>
          </div>;
        })}
        {!incomingRequests.length && <div className="gc-empty">No new requests.</div>}
        <h3 className="gc-section-title">Your Connections ({acceptedPeople.length})</h3>
        {acceptedPeople.map(person => <PersonCard key={person.id} person={person}/>)}
        <h3 className="gc-section-title">Requests Sent ({pendingSent.length})</h3>
        {pendingSent.map(req => {
          const person = profiles.find(p => p.id === req.receiver_id);
          return <div className="gc-person-card" key={req.id}><Avatar src={person?.avatar_url} name={person?.display_name}/><div className="gc-person-info"><b>{person?.display_name || "Member"}</b><span>Waiting for response</span></div><span className="gc-status">Pending</span></div>;
        })}
      </>
    );
  }

  function MessengerPage() {
    return (
      <>
        <PageHeader title="Messenger" subtitle="Connect privately with your friends." action={<button className="gc-icon-btn" onClick={loadChats}><RefreshCw/></button>}/>
        <div className="gc-messenger">
          <aside className={`gc-chat-list ${selectedChat ? "gc-chat-list-hide" : ""}`}>
            <h3>Chats</h3>
            {chats.map(person => (
              <button className={`gc-chat-person ${selectedChat?.id === person.id ? "active" : ""}`} key={person.id} onClick={() => setSelectedChat(person)}>
                <Avatar src={person.avatar_url} name={person.display_name}/>
                <span><b>{person.display_name || "Member"}</b><small>Tap to open conversation</small></span>
              </button>
            ))}
            {!chats.length && <div className="gc-empty">Connect with people to start chatting.</div>}
          </aside>
          <section className={`gc-chat-window ${!selectedChat ? "gc-chat-window-hide" : ""}`}>
            {selectedChat ? <>
              <div className="gc-chat-head">
                <button className="gc-icon-btn gc-mobile-back" onClick={() => setSelectedChat(null)}><ArrowLeft/></button>
                <Avatar src={selectedChat.avatar_url} name={selectedChat.display_name}/>
                <div><b>{selectedChat.display_name}</b><small>GLOBAL CONNECT</small></div>
                <div className="gc-chat-head-actions">
                  <button className="gc-icon-btn" onClick={() => startDirectCall(selectedChat, "audio")}><Phone size={18}/></button>
                  <button className="gc-icon-btn" onClick={() => startDirectCall(selectedChat, "video")}><Video size={18}/></button>
                </div>
              </div>
              <div className="gc-chat-messages">
                {messages.map(m => {
                  const mine = m.sender_id === userId;
                  return <div className={`gc-message-row ${mine ? "mine" : ""}`} key={m.id}>
                    <div className="gc-message-bubble">
                      <p>{m.content}</p>
                      <small>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} {mine && (m.read_at ? <><CheckCheck size={13}/> Seen</> : <Check size={13}/>)}</small>
                    </div>
                  </div>;
                })}
                <div ref={chatEndRef}/>
              </div>
              <div className="gc-chat-compose">
                <input value={messageText} onChange={e => setMessageText(e.target.value)} placeholder="Type a message..." onKeyDown={e => e.key === "Enter" && sendMessage()}/>
                <button className="gc-btn" onClick={sendMessage}><Send size={17}/></button>
              </div>
            </> : <div className="gc-chat-placeholder"><MessageCircle size={48}/><h3>Your conversations</h3><p>Select a chat to start messaging.</p></div>}
          </section>
        </div>
      </>
    );
  }

  function NotificationsPage() {
    return (
      <>
        <PageHeader title="Notifications" subtitle="Stay updated with your community." action={<button className="gc-icon-btn" onClick={loadNotifications}><RefreshCw/></button>}/>
        {notifications.map(n => (
          <button className={`gc-notification ${n.read ? "" : "unread"}`} key={n.id} onClick={() => markNotificationRead(n)}>
            <span className="gc-notification-icon"><Bell size={20}/></span>
            <span><b>{n.title || "New notification"}</b><small>{n.message || n.content || "You have an update."}</small><small>{timeAgo(n.created_at)}</small></span>
            {!n.read && <i/>}
          </button>
        ))}
        {!notifications.length && <div className="gc-empty">You are all caught up. No notifications yet.</div>}
      </>
    );
  }

  function ProfilePage() {
    return (
      <>
        <PageHeader title="My Profile" subtitle="Your identity on GLOBAL CONNECT." action={<button className="gc-btn" onClick={() => setProfileEdit(v => !v)}><Edit3 size={16}/> Edit Profile</button>}/>
        <div className="gc-profile-card">
          <div className="gc-cover" style={profile?.cover_url ? { backgroundImage: `url(${profile.cover_url})` } : {}}>
            <button className="gc-cover-edit" onClick={() => fileCoverRef.current?.click()}><Camera size={17}/> Cover</button>
            <input ref={fileCoverRef} hidden type="file" accept="image/*" onChange={e => uploadProfileImage(e.target.files?.[0], "cover_url")}/>
          </div>
          <div className="gc-profile-main">
            <div className="gc-profile-avatar">
              <Avatar src={profile?.avatar_url} name={profile?.display_name} size={100}/>
              <button onClick={() => fileAvatarRef.current?.click()}><Camera size={15}/></button>
              <input ref={fileAvatarRef} hidden type="file" accept="image/*" onChange={e => uploadProfileImage(e.target.files?.[0], "avatar_url")}/>
            </div>
            <h2>{profile?.display_name || "Your Name"}</h2>
            <p>{profile?.bio || "Add a bio to tell people about yourself."}</p>
            <span>{user?.email}</span>
          </div>
        </div>
        {profileEdit && (
          <div className="gc-panel">
            <h3>Edit your profile</h3>
            <label>Display Name</label>
            <input value={editName} onChange={e => setEditName(e.target.value)} maxLength={60}/>
            <label>Bio</label>
            <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={4} maxLength={300}/>
            <button className="gc-btn" onClick={saveProfile}>Save Changes</button>
          </div>
        )}
        <h3 className="gc-section-title">My Posts ({myPosts.length})</h3>
        {myPosts.map(post => <PostCard key={post.id} post={post}/>)}
      </>
    );
  }

  function LiveRoomsPage() {
    return (
      <>
        <PageHeader title="Live Rooms" subtitle="Create a room or join a live community."/>
        <div className="gc-panel">
          <h3><Radio size={20}/> Start your Live Room</h3>
          <input value={roomTitle} onChange={e => setRoomTitle(e.target.value)} placeholder="Give your room a title..."/>
          <button className="gc-btn" onClick={createRoom}><Radio size={16}/> Go Live</button>
        </div>
        {activeRoom && (
          <div className="gc-live-active">
            <span className="gc-live-label">● YOU ARE IN A ROOM</span>
            <h2>{activeRoom.title}</h2>
            <p>Room is active. Audio/video broadcasting needs the WebRTC media layer.</p>
            <button className="gc-btn gc-btn-danger" onClick={leaveRoom}>Leave Room</button>
          </div>
        )}
        <h3 className="gc-section-title">Live Now ({rooms.length})</h3>
        {rooms.map(room => (
          <div className="gc-person-card" key={room.id}>
            <span className="gc-room-icon"><Radio/></span>
            <div className="gc-person-info"><b>{room.title}</b><span>Host: {room.host_id === userId ? "You" : profiles.find(p => p.id === room.host_id)?.display_name || "Community member"}</span></div>
            <span className="gc-live-label">LIVE</span>
            <button className="gc-btn" onClick={() => joinRoom(room)}>Join</button>
          </div>
        ))}
        {!rooms.length && <div className="gc-empty">No live rooms right now. Create the first one!</div>}
      </>
    );
  }

  function RandomPage({ mode }) {
    const label = mode === "chat" ? "Random Chat" : mode === "video" ? "Random Video" : "Random Audio";
    const Icon = mode === "chat" ? Globe : mode === "video" ? Video : Headphones;
    return (
      <>
        <PageHeader title={label} subtitle="Meet new people from around the world."/>
        <div className="gc-random-card">
          <div className="gc-random-icon"><Icon size={48}/></div>
          <h2>{randomStatus === "searching" ? "Finding someone for you..." : "Meet Someone New"}</h2>
          <p>{mode === "chat" ? "Start a conversation with a random person." : `Connect with someone using ${mode} calling.`}</p>
          {randomStatus === "searching" ? (
            <><div className="gc-spinner"/><button className="gc-btn gc-btn-muted" onClick={stopRandomChat}>Cancel Search</button></>
          ) : (
            <button className="gc-btn" onClick={() => startRandomChat(mode)}><Search size={17}/> Start Matching</button>
          )}
          {mode !== "chat" && <small>Audio/video matching requires the WebRTC signaling service to be configured.</small>}
        </div>
      </>
    );
  }

  function SettingsPage() {
    return (
      <>
        <PageHeader title="Settings" subtitle="Manage your account and preferences."/>
        <div className="gc-panel">
          <h3><Shield size={20}/> Privacy</h3>
          <label className="gc-setting-row"><span><b>Private Account</b><small>Control who can connect with you.</small></span><input type="checkbox" checked={settings.private} onChange={e => setSettings(s => ({ ...s, private: e.target.checked }))}/></label>
          <label className="gc-setting-row"><span><b>Notifications</b><small>Receive app notifications.</small></span><input type="checkbox" checked={settings.notifications} onChange={e => setSettings(s => ({ ...s, notifications: e.target.checked }))}/></label>
        </div>
        <div className="gc-panel">
          <h3>Account</h3>
          <p>{user?.email}</p>
          <button className="gc-btn gc-btn-danger" onClick={logout}><LogOut size={16}/> Sign Out</button>
        </div>
      </>
    );
  }

  let pageContent;
  switch (page) {
    case "Home": pageContent = <HomePage/>; break;
    case "Social Feed": pageContent = <FeedPage/>; break;
    case "Stories": pageContent = <StoriesPage/>; break;
    case "Reels": pageContent = <ReelsPage/>; break;
    case "Discover": pageContent = <DiscoverPage/>; break;
    case "Connections": pageContent = <ConnectionsPage/>; break;
    case "Messenger": pageContent = <MessengerPage/>; break;
    case "Notifications": pageContent = <NotificationsPage/>; break;
    case "Profile": pageContent = <ProfilePage/>; break;
    case "Live Rooms": pageContent = <LiveRoomsPage/>; break;
    case "Random Chat": pageContent = <RandomPage mode="chat"/>; break;
    case "Random Video": pageContent = <RandomPage mode="video"/>; break;
    case "Random Audio": pageContent = <RandomPage mode="audio"/>; break;
    case "Settings": pageContent = <SettingsPage/>; break;
    default: pageContent = <HomePage/>;
  }

  return (
    <div className="gc-app">
      <aside className={`gc-sidebar ${mobileMenu ? "open" : ""}`}>
        <div className="gc-brand">
          <div className="gc-brand-icon"><Globe size={25}/></div>
          <div><b>GLOBAL CONNECT</b><small>MEET THE WORLD</small></div>
          <button className="gc-icon-btn gc-close-menu" onClick={() => setMobileMenu(false)}><X/></button>
        </div>
        <div className="gc-side-profile">
          <Avatar src={profile?.avatar_url} name={profile?.display_name} size={43} online/>
          <span><b>{profile?.display_name || "Your Profile"}</b><small>Online</small></span>
        </div>
        <nav className="gc-nav">
          {NAV.map(([name, Icon]) => (
            <button key={name} className={page === name ? "active" : ""} onClick={() => { setPage(name); setMobileMenu(false); }}>
              <Icon size={19}/><span>{name}</span>
              {name === "Notifications" && unreadNotifications > 0 && <i className="gc-nav-badge">{unreadNotifications}</i>}
            </button>
          ))}
        </nav>
        <button className="gc-logout" onClick={logout}><LogOut size={18}/> Sign Out</button>
      </aside>
      {mobileMenu && <div className="gc-overlay" onClick={() => setMobileMenu(false)}/>}
      <main className="gc-main">
        <header className="gc-topbar">
          <button className="gc-icon-btn gc-menu-btn" onClick={() => setMobileMenu(true)}><Menu/></button>
          <div className="gc-top-search"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search GLOBAL CONNECT..." onKeyDown={e => e.key === "Enter" && setPage("Discover")}/></div>
          <button className="gc-icon-btn" onClick={() => setPage("Notifications")}><Bell/>{unreadNotifications > 0 && <i className="gc-dot-badge"/>}</button>
          <button className="gc-top-user" onClick={() => setPage("Profile")}><Avatar src={profile?.avatar_url} name={profile?.display_name} size={34}/><span>{profile?.display_name || "Profile"}</span></button>
        </header>
        <div className="gc-content">
          {pageContent}
          <footer className="gc-footer">© {new Date().getFullYear()} GLOBAL CONNECT · Meet the World</footer>
        </div>
      </main>

      {selectedStory && (
        <div className="gc-modal" onClick={() => setSelectedStory(null)}>
          <button className="gc-modal-close" onClick={() => setSelectedStory(null)}><X/></button>
          {selectedStory.media_type === "video"
            ? <video src={selectedStory.media_url} controls autoPlay onClick={e => e.stopPropagation()}/>
            : <img src={selectedStory.media_url} alt="Story" onClick={e => e.stopPropagation()}/>}
        </div>
      )}

      {callPeer && (
        <div className="gc-modal">
          <div className="gc-call-card">
            <Avatar src={callPeer.avatar_url} name={callPeer.display_name} size={90}/>
            <h2>{callPeer.display_name}</h2>
            <p>{callMode === "video" ? "Video call" : "Audio call"} · WebRTC setup required</p>
            <button className="gc-btn gc-btn-danger" onClick={() => { setCallPeer(null); setCallState("idle"); }}>End Call</button>
          </div>
        </div>
      )}
      {notice && <div className="gc-toast">{notice}</div>}
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<ErrorBoundary><App/></ErrorBoundary>);
