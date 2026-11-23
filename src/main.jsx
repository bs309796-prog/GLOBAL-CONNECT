import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Auth from "./Auth.jsx";
import { supabase } from "./supabase.js";
import "./style.css";

const styles = {
  loading: {
    minHeight: "100vh", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", color: "white",
    background: "#101827"
  },
  error: {
    padding: 30, color: "#fff", background: "#251b28",
    minHeight: "100vh"
  },
  notice: {
    padding: 12, margin: 12, borderRadius: 8,
    background: "#e0f2fe", color: "#075985"
  },
  avatar: {
    width: "100%", height: "100%", objectFit: "cover",
    borderRadius: "50%"
  },
  postForm: {
    padding: 16, borderRadius: 12, margin: "20px 0",
    background: "rgba(128,128,128,0.08)"
  },
  postTextarea: {
    width: "100%", padding: 12, borderRadius: 8,
    resize: "vertical", boxSizing: "border-box"
  },
  fileLabel: {
    display: "block", padding: 12, margin: "12px 0",
    cursor: "pointer"
  },
  fileName: { fontSize: 13, opacity: 0.7 },
  feedHeading: {
    display: "flex", alignItems: "center",
    justifyContent: "space-between", gap: 10
  },
  postsList: {
    display: "grid", gap: 18, marginTop: 20
  },
  postCard: {
    padding: 16, borderRadius: 14,
    background: "rgba(128,128,128,0.08)",
    overflow: "hidden"
  },
  postAuthor: {
    display: "flex", alignItems: "center",
    gap: 12, marginBottom: 12
  },
  postAvatar: {
    width: 42, height: 42, borderRadius: "50%",
    objectFit: "cover"
  },
  postAvatarFallback: {
    width: 42, height: 42, borderRadius: "50%",
    display: "grid", placeItems: "center",
    background: "#64748b"
  },
  postDate: {
    display: "block", fontSize: 11, opacity: 0.65
  },
  postContent: {
    whiteSpace: "pre-wrap", overflowWrap: "anywhere"
  },
  postMedia: {
    width: "100%", maxHeight: 500, objectFit: "contain",
    borderRadius: 10, marginTop: 10
  },
  deleteButton: {
    marginTop: 12, padding: "9px 14px",
    border: "none", borderRadius: 8,
    background: "#dc2626", color: "white",
    cursor: "pointer"
  },
  profileCover: {
    width: "100%", height: 180, objectFit: "cover",
    borderRadius: 12, background: "#334155"
  },
  profileAvatar: {
    width: 100, height: 100, borderRadius: "50%",
    objectFit: "cover", border: "4px solid white",
    marginTop: -50, background: "#475569"
  },
  field: {
    width: "100%", padding: 12, margin: "8px 0 16px",
    borderRadius: 8, boxSizing: "border-box"
  },
  personCard: {
    display: "flex", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 12,
    background: "rgba(128,128,128,0.08)"
  },
  personAvatar: {
    width: 50, height: 50, borderRadius: "50%",
    objectFit: "cover", background: "#475569"
  },
  connectionButton: {
    padding: "9px 13px", border: "none", borderRadius: 8,
    background: "#2563eb", color: "white", cursor: "pointer",
    whiteSpace: "nowrap"
  },
  secondaryButton: {
    padding: "9px 13px", border: "1px solid #94a3b8",
    borderRadius: 8, background: "transparent",
    cursor: "pointer", whiteSpace: "nowrap"
  }
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={styles.error}>
          <h2>GLOBAL CONNECT Error</h2>
          <p>{this.state.error.message}</p>
          <button onClick={() => window.location.reload()}>
            Reload Website
          </button>
        </div>
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
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");

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
  const [deletingPost, setDeletingPost] = useState("");

  const [people, setPeople] = useState([]);
  const [loadingPeople, setLoadingPeople] = useState(false);

  // Connect request system
  const [connections, setConnections] = useState([]);
  const [connectionProfiles, setConnectionProfiles] = useState({});
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [connectionAction, setConnectionAction] = useState("");

  const menu = [
    ["Home", "🏠"],
    ["Social Feed", "📰"],
    ["Random Video", "📹"],
    ["Random Audio", "📞"],
    ["Random Chat", "💬"],
    ["Messenger", "✉️"],
    ["Discover", "🌍"],
    ["Connections", "🤝"],
    ["Reels", "▶️"],
    ["Live Rooms", "🔴"],
    ["Profile", "👤"],
    ["Notifications", "🔔"]
  ];

  // Authentication
  useEffect(() => {
    let active = true;

    const { data } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (active) {
          setUser(session?.user || null);
          setChecking(false);
        }
      }
    );

    supabase.auth.getSession()
      .then(({ data: result, error }) => {
        if (!active) return;

        if (error) {
          setNotice("Login connection error: " + error.message);
          setUser(null);
        } else {
          setUser(result.session?.user || null);
        }

        setChecking(false);
      })
      .catch(error => {
        if (active) {
          setNotice("Connection error: " + error.message);
          setChecking(false);
        }
      });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // Load own profile
  useEffect(() => {
    if (!user) return;

    let active = true;

    async function loadProfile() {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("display_name, bio, avatar_url, cover_url")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (active && data) {
          setProfile({
            display_name: data.display_name || "",
            bio: data.bio || "",
            avatar_url: data.avatar_url || "",
            cover_url: data.cover_url || ""
          });
        }
      } catch (error) {
        if (active) {
          setNotice("Profile error: " + error.message);
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [user]);

  // Load community posts
  async function loadPosts() {
    setLoadingPosts(true);
    setNotice("");

    try {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const postList = data || [];
      const userIds = [
        ...new Set(postList.map(post => post.user_id).filter(Boolean))
      ];

      let profileMap = {};

      if (userIds.length > 0) {
        const { data: peopleData, error: profileError } =
          await supabase
            .from("profiles")
            .select("id, display_name, avatar_url")
            .in("id", userIds);

        if (!profileError) {
          (peopleData || []).forEach(person => {
            profileMap[person.id] = person;
          });
        }
      }

      setPosts(postList.map(post => ({
        ...post,
        author:
          profileMap[post.user_id]?.display_name ||
          "Community Member",
        authorAvatar:
          profileMap[post.user_id]?.avatar_url || ""
      })));
    } catch (error) {
      setNotice("Posts loading error: " + error.message);
    } finally {
      setLoadingPosts(false);
    }
  }

  useEffect(() => {
    if (
      user &&
      ["Social Feed", "Reels"].includes(page)
    ) {
      loadPosts();
    }
  }, [page, user]);

  // Load Discover people
  async function loadPeople() {
    if (!user) return;

    setLoadingPeople(true);
    setNotice("");

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, bio, avatar_url")
        .neq("id", user.id)
        .order("display_name", { ascending: true })
        .limit(50);

      if (error) throw error;

      setPeople(data || []);
    } catch (error) {
      setNotice("Discover error: " + error.message);
    } finally {
      setLoadingPeople(false);
    }
  }

  // Load sent and received connection requests
  async function loadConnections() {
    if (!user) return;

    setLoadingConnections(true);

    try {
      const [sentResult, receivedResult] = await Promise.all([
        supabase
          .from("connections")
          .select("*")
          .eq("sender_id", user.id),
        supabase
          .from("connections")
          .select("*")
          .eq("receiver_id", user.id)
      ]);

      if (sentResult.error) throw sentResult.error;
      if (receivedResult.error) throw receivedResult.error;

      const combined = [
        ...(sentResult.data || []),
        ...(receivedResult.data || [])
      ];

      const unique = Array.from(
        new Map(combined.map(item => [item.id, item])).values()
      );

      setConnections(unique);

      const otherIds = [
        ...new Set(unique.map(item =>
          item.sender_id === user.id ? item.receiver_id : item.sender_id
        ).filter(Boolean))
      ];

      if (otherIds.length) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, display_name, bio, avatar_url")
          .in("id", otherIds);

        if (profilesError) throw profilesError;

        const profileMap = {};
        (profilesData || []).forEach(item => {
          profileMap[item.id] = item;
        });
        setConnectionProfiles(profileMap);
      } else {
        setConnectionProfiles({});
      }
    } catch (error) {
      setNotice("Connections loading error: " + error.message);
    } finally {
      setLoadingConnections(false);
    }
  }

  useEffect(() => {
    if (user && ["Discover", "Connections"].includes(page)) {
      loadConnections();
    }
    if (user && page === "Discover") {
      loadPeople();
    }
  }, [page, user]);

  function getConnectionFor(personId) {
    const matching = connections.filter(item =>
      (item.sender_id === user.id && item.receiver_id === personId) ||
      (item.sender_id === personId && item.receiver_id === user.id)
    );

    const accepted = matching.find(item => item.status === "accepted");
    if (accepted) return accepted;

    const incoming = matching.find(item =>
      item.status === "pending" && item.receiver_id === user.id
    );
    if (incoming) return incoming;

    const outgoing = matching.find(item =>
      item.status === "pending" && item.sender_id === user.id
    );
    if (outgoing) return outgoing;

    return null;
  }

  async function sendConnectionRequest(person) {
    if (!user || !person?.id || person.id === user.id) return;

    const current = getConnectionFor(person.id);
    if (current) return;

    setConnectionAction(person.id);
    setNotice("");

    try {
      const { data: existingRows, error: existingError } = await supabase
        .from("connections")
        .select("id, status")
        .eq("sender_id", user.id)
        .eq("receiver_id", person.id);

      if (existingError) throw existingError;

      const activeRequest = (existingRows || []).find(row =>
        row.status === "pending" || row.status === "accepted"
      );

      if (activeRequest) {
        await loadConnections();
        return;
      }

      const { error } = await supabase
        .from("connections")
        .insert({
          sender_id: user.id,
          receiver_id: person.id,
          status: "pending"
        });

      if (error) throw error;

      setNotice("Connection request sent!");
      await loadConnections();
    } catch (error) {
      setNotice("Request error: " + error.message);
    } finally {
      setConnectionAction("");
    }
  }

  async function respondToConnection(connection, status) {
    if (
      !user ||
      connection.receiver_id !== user.id ||
      connection.status !== "pending"
    ) {
      setNotice("This request cannot be updated from your account.");
      return;
    }

    setConnectionAction(connection.id);
    setNotice("");

    try {
      const { error } = await supabase
        .from("connections")
        .update({ status })
        .eq("id", connection.id)
        .eq("receiver_id", user.id)
        .eq("status", "pending");

      if (error) throw error;

      setNotice(
        status === "accepted"
          ? "Connection request accepted!"
          : "Connection request rejected."
      );
      await loadConnections();
    } catch (error) {
      setNotice("Response error: " + error.message);
    } finally {
      setConnectionAction("");
    }
  }

  function openPage(name) {
    setPage(name);
    setNotice("");
  }

  // Logout
  async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setNotice("Logout error: " + error.message);
      return;
    }

    setUser(null);
    setPage("Home");
    setConnections([]);
    setConnectionProfiles({});

    setProfile({
      display_name: "",
      bio: "",
      avatar_url: "",
      cover_url: ""
    });
  }

  // Save profile
  async function saveProfile(event) {
    event.preventDefault();

    if (!user) {
      setNotice("Please login first.");
      return;
    }

    setSaving(true);
    setNotice("");

    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          display_name: profile.display_name.trim(),
          bio: profile.bio.trim(),
          avatar_url: profile.avatar_url,
          cover_url: profile.cover_url,
          updated_at: new Date().toISOString()
        }, { onConflict: "id" });

      if (error) throw error;

      setNotice("Profile saved successfully!");
    } catch (error) {
      setNotice("Profile save error: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  // Upload profile and cover photos
  async function uploadImage(file, type) {
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      setNotice("Please select an image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setNotice("Image must be smaller than 5 MB.");
      return;
    }

    setUploading(type);
    setNotice("");

    try {
      const extension = file.name.split(".").pop().toLowerCase();
      const path =
        `${user.id}/${type}-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-media")
        .upload(path, file, {
          upsert: true,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("profile-media")
        .getPublicUrl(path);

      const url = data.publicUrl;
      const field =
        type === "avatar" ? "avatar_url" : "cover_url";

      const updated = {
        id: user.id,
        display_name: profile.display_name.trim(),
        bio: profile.bio.trim(),
        avatar_url: field === "avatar_url" ? url : profile.avatar_url,
        cover_url: field === "cover_url" ? url : profile.cover_url,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from("profiles")
        .upsert(updated, { onConflict: "id" });

      if (error) throw error;

      setProfile(old => ({ ...old, [field]: url }));

      setNotice(
        type === "avatar"
          ? "Profile photo uploaded!"
          : "Cover photo uploaded!"
      );
    } catch (error) {
      setNotice("Upload error: " + error.message);
    } finally {
      setUploading("");
    }
  }

  // Create a post
  async function createPost(event) {
    event.preventDefault();

    if (!postText.trim() && !postFile) {
      setNotice("Please write something or select a photo/video.");
      return;
    }

    if (
      postFile &&
      !postFile.type.startsWith("image/") &&
      !postFile.type.startsWith("video/")
    ) {
      setNotice("Please select an image or video.");
      return;
    }

    if (postFile && postFile.size > 50 * 1024 * 1024) {
      setNotice("File must be smaller than 50 MB.");
      return;
    }

    setPosting(true);
    setNotice("");

    try {
      let mediaUrl = null;
      let mediaType = null;

      if (postFile) {
        const extension = postFile.name.split(".").pop().toLowerCase();
        const path = `${user.id}/post-${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("post-media")
          .upload(path, postFile, {
            upsert: false,
            contentType: postFile.type
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("post-media")
          .getPublicUrl(path);

        mediaUrl = data.publicUrl;
        mediaType = postFile.type.startsWith("video/")
          ? "video"
          : "image";
      }

      const { error } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          content: postText.trim(),
          media_url: mediaUrl,
          media_type: mediaType
        });

      if (error) throw error;

      setPostText("");
      setPostFile(null);

      const fileInput =
        document.getElementById("post-file-input");

      if (fileInput) fileInput.value = "";

      setNotice("Your post was published!");
      await loadPosts();
    } catch (error) {
      setNotice("Post error: " + error.message);
    } finally {
      setPosting(false);
    }
  }

  // Delete own post
  async function deletePost(post) {
    if (post.user_id !== user.id) {
      setNotice("You can only delete your own posts.");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this post?")) {
      return;
    }

    setDeletingPost(post.id);
    setNotice("");

    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id)
        .eq("user_id", user.id);

      if (error) throw error;

      if (post.media_url) {
        try {
          const marker = "/post-media/";
          const path = post.media_url.split(marker)[1];

          if (path) {
            await supabase.storage
              .from("post-media")
              .remove([decodeURIComponent(path)]);
          }
        } catch (storageError) {
          console.log("Media cleanup issue:", storageError);
        }
      }

      setPosts(old => old.filter(item => item.id !== post.id));
      setNotice("Post deleted successfully!");
    } catch (error) {
      setNotice("Delete error: " + error.message);
    } finally {
      setDeletingPost("");
    }
  }

  // Authentication screen
  if (checking) {
    return (
      <div style={styles.loading}>
        <h2>🌍 GLOBAL CONNECT</h2>
        <p>Connecting to your account...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Auth onLogin={setUser} />
        {notice && <div style={styles.notice}>{notice}</div>}
      </>
    );
  }

  return (
    <div className="app">

      {/* HEADER */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">🌍</div>
          <div>
            <h2>GLOBAL <span>CONNECT</span></h2>
            <small>MEET THE WORLD</small>
          </div>
        </div>

        <div className="top-actions">
          <button
            className="icon-btn"
            onClick={() => openPage("Discover")}
          >🔍</button>

          <button
            className="icon-btn"
            onClick={() => openPage("Notifications")}
          >🔔</button>

          <button
            className="avatar"
            onClick={() => openPage("Profile")}
          >
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="Profile" style={styles.avatar} />
              : (user.email?.[0]?.toUpperCase() || "G")}
          </button>

          <button className="icon-btn" onClick={logout}>↪</button>
        </div>
      </header>

      <div className="layout">

        {/* SIDEBAR */}
        <aside className="sidebar">
          <p className="menu-label">MAIN MENU</p>

          {menu.map(([name, emoji]) => (
            <button
              key={name}
              className={
                "nav-item " + (page === name ? "active" : "")
              }
              onClick={() => openPage(name)}
            >
              <span>{emoji}</span>
              <span>{name}</span>
            </button>
          ))}

          <div className="sidebar-bottom">
            <span>🛡️</span>
            <div>
              <b>Safe Community</b>
              <small>Connect respectfully</small>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="content">

          {/* HOME */}
          {page === "Home" && (
            <>
              <section className="hero">
                <div className="hero-content">
                  <span className="eyebrow">
                    ✨ YOUR WORLD. YOUR PEOPLE.
                  </span>

                  <h1>
                    Meet The World.<br />
                    <span>Make New Friends.</span>
                  </h1>

                  <p>
                    Connect with people around the globe
                    through video, audio and chat.
                  </p>

                  <button
                    className="primary-btn"
                    onClick={() => openPage("Random Video")}
                  >
                    📹 Start Meeting →
                  </button>
                </div>

                <div className="globe-art">🌍</div>
              </section>

              <div className="section-heading">
                <div>
                  <h2>Start Connecting</h2>
                  <p>Choose how you want to meet people</p>
                </div>
                <span className="online-tag">● WORLDWIDE</span>
              </div>

              <div className="feature-grid">
                {[
                  ["Random Video", "📹", "Meet strangers face to face", "video-card"],
                  ["Random Audio", "📞", "Talk to someone new", "audio-card"],
                  ["Random Chat", "💬", "Start a conversation", "chat-card"],
                  ["Discover", "🌍", "Discover new connections", "friends-card"]
                ].map(([name, emoji, description, className]) => (
                  <button
                    key={name}
                    className={"feature-card " + className}
                    onClick={() => openPage(name)}
                  >
                    <div className="feature-icon">{emoji}</div>
                    <h3>{name}</h3>
                    <p>{description}</p>
                    <span className="feature-arrow">→</span>
                  </button>
                ))}
              </div>

              <div className="community-card">
                <div className="community-icon">🖼️</div>
                <div>
                  <h3>Your social world starts here</h3>
                  <p>Share photos, videos and moments with your community.</p>
                </div>
                <button
                  className="outline-btn"
                  onClick={() => openPage("Social Feed")}
                >
                  Create Post
                </button>
              </div>
            </>
          )}

          {/* SOCIAL FEED */}
          {page === "Social Feed" && (
            <section className="work-panel">
              <h1>Global <span>Social Feed</span></h1>
              <p>Share your moments with the world 🌍</p>

              <form onSubmit={createPost} style={styles.postForm}>
                <textarea
                  rows={4}
                  maxLength={2000}
                  value={postText}
                  onChange={event => setPostText(event.target.value)}
                  placeholder="What's happening? Share something with the world..."
                  style={styles.postTextarea}
                />

                <label style={styles.fileLabel}>
                  📷 Choose Photo or Video
                  <input
                    id="post-file-input"
                    type="file"
                    accept="image/*,video/*"
                    style={{ display: "block", marginTop: 10 }}
                    onChange={event =>
                      setPostFile(event.target.files?.[0] || null)
                    }
                  />
                </label>

                {postFile && (
                  <p style={styles.fileName}>
                    Selected: {postFile.name}
                  </p>
                )}

                <button
                  className="primary-btn"
                  type="submit"
                  disabled={posting}
                >
                  {posting ? "Publishing..." : "🌍 Publish Post"}
                </button>
              </form>

              <div style={styles.feedHeading}>
                <h2>Community Posts</h2>
                <button
                  className="outline-btn"
                  onClick={loadPosts}
                  disabled={loadingPosts}
                >
                  {loadingPosts ? "Loading..." : "↻ Refresh"}
                </button>
              </div>

              {loadingPosts && <p>Loading posts...</p>}

              {!loadingPosts && posts.length === 0 && (
                <div className="call-preview">
                  <h3>📰 No posts yet</h3>
                  <p>
                    Be the first person to share something
                    with the community!
                  </p>
                </div>
              )}

              <div style={styles.postsList}>
                {posts.map(post => (
                  <article key={post.id} style={styles.postCard}>
                    <div style={styles.postAuthor}>
                      {post.authorAvatar
                        ? <img src={post.authorAvatar} alt="" style={styles.postAvatar} />
                        : <div style={styles.postAvatarFallback}>👤</div>}

                      <div>
                        <strong>{post.author}</strong>
                        <small style={styles.postDate}>
                          {post.created_at
                            ? new Date(post.created_at).toLocaleString()
                            : ""}
                        </small>
                      </div>
                    </div>

                    {post.content && (
                      <p style={styles.postContent}>{post.content}</p>
                    )}

                    {post.media_url && post.media_type === "video" && (
                      <video
                        src={post.media_url}
                        controls
                        playsInline
                        style={styles.postMedia}
                      />
                    )}

                    {post.media_url && post.media_type !== "video" && (
                      <img
                        src={post.media_url}
                        alt="Community post"
                        style={styles.postMedia}
                      />
                    )}

                    {post.user_id === user.id && (
                      <button
                        style={styles.deleteButton}
                        disabled={deletingPost === post.id}
                        onClick={() => deletePost(post)}
                      >
                        {deletingPost === post.id
                          ? "Deleting..."
                          : "🗑️ Delete Post"}
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* RANDOM VIDEO */}
          {page === "Random Video" && (
            <section className="work-panel">
              <h1>Random <span>Video Chat</span></h1>
              <div className="call-preview">
                <h3>📹 Ready to meet someone new?</h3>
                <p>Live video matching server is not connected yet.</p>
              </div>
              <button
                className="primary-btn"
                onClick={() => setNotice(
                  "Video calling will be enabled after the calling server is connected."
                )}
              >
                Start Video
              </button>
            </section>
          )}

          {/* RANDOM AUDIO */}
          {page === "Random Audio" && (
            <section className="work-panel">
              <h1>Random <span>Audio Call</span></h1>
              <div className="call-preview">
                <h3>🎙️ Discover a new voice</h3>
                <p>Live audio calling server is not connected yet.</p>
              </div>
              <button
                className="primary-btn"
                onClick={() => setNotice(
                  "Audio calling will be enabled after the calling server is connected."
                )}
              >
                Start Audio Call
              </button>
            </section>
          )}

          {/* RANDOM CHAT */}
          {page === "Random Chat" && (
            <section className="work-panel">
              <h1>Random <span>Chat</span></h1>
              <div className="call-preview">
                <h3>💬 Your next conversation awaits</h3>
                <p>Random chat matching is not connected yet.</p>
              </div>
              <button
                className="primary-btn"
                onClick={() => setNotice(
                  "Random chat matching server is not connected yet."
                )}
              >
                Find Someone
              </button>
            </section>
          )}

          {/* MESSENGER */}
          {page === "Messenger" && (
            <section className="work-panel">
              <h1>Your <span>Messenger</span></h1>

              <div className="call-preview">
                <h3>✉️ Your inbox</h3>
                <p>
                  Private and group messaging will be connected
                  in the next stage.
                </p>
              </div>
            </section>
          )}

          {/* DISCOVER */}
          {page === "Discover" && (
            <section className="work-panel">
              <h1>Discover <span>People</span></h1>
              <p>🌍 Find new connections around the world.</p>

              <div style={styles.feedHeading}>
                <h2>Community Members</h2>
                <button
                  className="outline-btn"
                  onClick={() => {
                    loadPeople();
                    loadConnections();
                  }}
                  disabled={loadingPeople || loadingConnections}
                >
                  {loadingPeople || loadingConnections ? "Loading..." : "↻ Refresh"}
                </button>
              </div>

              {loadingPeople && <p>Finding people...</p>}

              {!loadingPeople && people.length === 0 && (
                <div className="call-preview">
                  <h3>🌍 No members found</h3>
                  <p>New community members will appear here.</p>
                </div>
              )}

              <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
                {people.map(person => {
                  const relationship = getConnectionFor(person.id);
                  const isAccepted = relationship?.status === "accepted";
                  const isIncoming =
                    relationship?.status === "pending" &&
                    relationship.receiver_id === user.id;
                  const isOutgoing =
                    relationship?.status === "pending" &&
                    relationship.sender_id === user.id;

                  return (
                    <div key={person.id} style={styles.personCard}>
                      {person.avatar_url
                        ? <img src={person.avatar_url} alt="" style={styles.personAvatar} />
                        : <div style={styles.personAvatar}>👤</div>}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong>
                          {person.display_name || "Community Member"}
                        </strong>
                        <p style={{ margin: "5px 0", fontSize: 13 }}>
                          {person.bio || "New member of GLOBAL CONNECT"}
                        </p>
                      </div>

                      {isAccepted ? (
                        <span style={{ color: "#16a34a", fontWeight: 700 }}>
                          ✓ Connected
                        </span>
                      ) : isOutgoing ? (
                        <span style={{ color: "#64748b", fontSize: 13 }}>
                          Request Sent
                        </span>
                      ) : isIncoming ? (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            style={styles.connectionButton}
                            disabled={connectionAction === relationship.id}
                            onClick={() => respondToConnection(relationship, "accepted")}
                          >
                            Accept
                          </button>
                          <button
                            style={styles.secondaryButton}
                            disabled={connectionAction === relationship.id}
                            onClick={() => respondToConnection(relationship, "rejected")}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <button
                          style={styles.connectionButton}
                          disabled={connectionAction === person.id}
                          onClick={() => sendConnectionRequest(person)}
                        >
                          {connectionAction === person.id ? "Sending..." : "🤝 Connect"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* CONNECTIONS */}
          {page === "Connections" && (
            <section className="work-panel">
              <h1>My <span>Connections</span></h1>
              <p>Manage your connection requests and friends. 🤝</p>

              <div style={{ ...styles.feedHeading, marginTop: 20 }}>
                <h2>Incoming Requests</h2>
                <button
                  className="outline-btn"
                  onClick={loadConnections}
                  disabled={loadingConnections}
                >
                  {loadingConnections ? "Loading..." : "↻ Refresh"}
                </button>
              </div>

              {loadingConnections && <p>Loading your connections...</p>}

              {!loadingConnections && connections.filter(item =>
                item.status === "pending" && item.receiver_id === user.id
              ).length === 0 && (
                <div className="call-preview">
                  <h3>📭 No pending requests</h3>
                  <p>When someone sends you a request, it will appear here.</p>
                </div>
              )}

              <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                {connections
                  .filter(item =>
                    item.status === "pending" && item.receiver_id === user.id
                  )
                  .map(item => {
                    const person = connectionProfiles[item.sender_id] || {};
                    return (
                      <div key={item.id} style={styles.personCard}>
                        {person.avatar_url
                          ? <img src={person.avatar_url} alt="" style={styles.personAvatar} />
                          : <div style={styles.personAvatar}>👤</div>}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong>{person.display_name || "Community Member"}</strong>
                          <p style={{ margin: "5px 0", fontSize: 13 }}>
                            {person.bio || "Wants to connect with you"}
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            style={styles.connectionButton}
                            disabled={connectionAction === item.id}
                            onClick={() => respondToConnection(item, "accepted")}
                          >
                            Accept
                          </button>
                          <button
                            style={styles.secondaryButton}
                            disabled={connectionAction === item.id}
                            onClick={() => respondToConnection(item, "rejected")}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <h2 style={{ marginTop: 28 }}>Connected People</h2>
              {!loadingConnections && connections.filter(item =>
                item.status === "accepted"
              ).length === 0 && (
                <div className="call-preview">
                  <h3>🤝 No connections yet</h3>
                  <p>Visit Discover and send a connection request to someone.</p>
                  <button
                    className="primary-btn"
                    onClick={() => openPage("Discover")}
                  >
                    Discover People
                  </button>
                </div>
              )}

              <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                {connections
                  .filter(item => item.status === "accepted")
                  .map(item => {
                    const otherId =
                      item.sender_id === user.id ? item.receiver_id : item.sender_id;
                    const person = connectionProfiles[otherId] || {};
                    return (
                      <div key={item.id} style={styles.personCard}>
                        {person.avatar_url
                          ? <img src={person.avatar_url} alt="" style={styles.personAvatar} />
                          : <div style={styles.personAvatar}>👤</div>}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong>{person.display_name || "Community Member"}</strong>
                          <p style={{ margin: "5px 0", fontSize: 13 }}>
                            {person.bio || "GLOBAL CONNECT member"}
                          </p>
                        </div>
                        <span style={{ color: "#16a34a", fontWeight: 700 }}>
                          ✓ Connected
                        </span>
                      </div>
                    );
                  })}
              </div>
            </section>
          )}

          {/* REELS */}
          {page === "Reels" && (
            <section className="work-panel">
              <h1>Global <span>Reels</span></h1>
              <p>▶️ Short videos from your community</p>

              {loadingPosts && <p>Loading videos...</p>}

              {!loadingPosts &&
                posts.filter(post =>
                  post.media_type === "video" && post.media_url
                ).length === 0 && (
                  <div className="call-preview">
                    <h3>▶️ No Reels yet</h3>
                    <p>
                      Community videos will appear here.
                      Upload a video in Social Feed to get started.
                    </p>
                    <button
                      className="primary-btn"
                      onClick={() => openPage("Social Feed")}
                    >
                      Create Video Post
                    </button>
                  </div>
                )}

              <div style={styles.postsList}>
                {posts
                  .filter(post =>
                    post.media_type === "video" && post.media_url
                  )
                  .map(post => (
                    <article key={post.id} style={styles.postCard}>
                      <strong>{post.author}</strong>
                      {post.content && <p>{post.content}</p>}
                      <video
                        src={post.media_url}
                        controls
                        playsInline
                        style={styles.postMedia}
                      />
                      {post.user_id === user.id && (
                        <button
                          style={styles.deleteButton}
                          onClick={() => deletePost(post)}
                          disabled={deletingPost === post.id}
                        >
                          🗑️ Delete Reel
                        </button>
                      )}
                    </article>
                  ))}
              </div>
            </section>
          )}

          {/* LIVE ROOMS */}
          {page === "Live Rooms" && (
            <section className="work-panel">
              <h1>Global <span>Live Rooms</span></h1>

              <div className="call-preview">
                <h3>🔴 Join the conversation</h3>
                <p>
                  Live audio and video rooms will be available
                  after the real-time room server is connected.
                </p>
              </div>

              <button
                className="primary-btn"
                onClick={() => setNotice(
                  "Live Rooms are not connected yet. A real-time server is required."
                )}
              >
                Create Live Room
              </button>
            </section>
          )}

          {/* PROFILE */}
          {page === "Profile" && (
            <section className="work-panel">
              <h1>Your <span>Profile</span></h1>

              <img
                src={profile.cover_url || ""}
                alt="Cover"
                style={styles.profileCover}
                onError={event => {
                  event.currentTarget.style.visibility = "hidden";
                }}
              />

              {!profile.cover_url && (
                <div style={{
                  ...styles.profileCover,
                  display: "grid",
                  placeItems: "center"
                }}>
                  Cover Photo
                </div>
              )}

              <label style={styles.fileLabel}>
                🖼️ Change Cover Photo
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "block", marginTop: 8 }}
                  disabled={uploading === "cover"}
                  onChange={event =>
                    uploadImage(event.target.files?.[0], "cover")
                  }
                />
              </label>

              {uploading === "cover" && <p>Uploading cover...</p>}

              {profile.avatar_url
                ? (
                  <img
                    src={profile.avatar_url}
                    alt="Profile"
                    style={styles.profileAvatar}
                  />
                )
                : (
                  <div style={styles.profileAvatar}>
                    👤
                  </div>
                )}

              <label style={styles.fileLabel}>
                📷 Change Profile Photo
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "block", marginTop: 8 }}
                  disabled={uploading === "avatar"}
                  onChange={event =>
                    uploadImage(event.target.files?.[0], "avatar")
                  }
                />
              </label>

              {uploading === "avatar" && <p>Uploading profile photo...</p>}

              <form onSubmit={saveProfile}>
                <label>Display Name</label>
                <input
                  style={styles.field}
                  type="text"
                  maxLength={60}
                  value={profile.display_name}
                  onChange={event =>
                    setProfile(old => ({
                      ...old,
                      display_name: event.target.value
                    }))
                  }
                  placeholder="Enter your name"
                />

                <label>Email Address</label>
                <input
                  style={styles.field}
                  value={user.email || ""}
                  disabled
                  readOnly
                />

                <label>Bio</label>
                <textarea
                  style={styles.field}
                  rows={4}
                  maxLength={300}
                  value={profile.bio}
                  onChange={event =>
                    setProfile(old => ({
                      ...old,
                      bio: event.target.value
                    }))
                  }
                  placeholder="Tell people about yourself..."
                />

                <button
                  className="primary-btn"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "💾 Save Profile"}
                </button>
              </form>
            </section>
          )}

          {/* NOTIFICATIONS */}
          {page === "Notifications" && (
            <section className="work-panel">
              <h1>Your <span>Notifications</span></h1>

              <div className="call-preview">
                <h3>🔔 Stay Updated</h3>
                <p>
                  Your community notifications will appear here
                  when the notification system is connected.
                </p>
              </div>
            </section>
          )}

          {/* UNKNOWN PAGE */}
          {!menu.some(item => item[0] === page) && (
            <section className="work-panel">
              <h1>Page <span>Not Found</span></h1>
              <button
                className="primary-btn"
                onClick={() => openPage("Home")}
              >
                Go Home
              </button>
            </section>
          )}

          {/* NOTICES */}
          {notice && (
            <div style={styles.notice}>
              {notice}
              <button
                onClick={() => setNotice("")}
                style={{
                  float: "right",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer"
                }}
              >
                ✕
              </button>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

// Application entry point
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
