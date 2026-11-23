import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Auth from "./Auth.jsx";
import { supabase } from "./supabase.js";
import "./style.css";

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
          <button onClick={() => window.location.reload()}>Reload Website</button>
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
    display_name: "", bio: "", avatar_url: "", cover_url: ""
  });

  const [posts, setPosts] = useState([]);
  const [postText, setPostText] = useState("");
  const [postFile, setPostFile] = useState(null);
  const [posting, setPosting] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [deletingPost, setDeletingPost] = useState("");

  const menu = [
    ["Home", "🏠"],
    ["Social Feed", "📰"],
    ["Random Video", "📹"],
    ["Random Audio", "📞"],
    ["Random Chat", "💬"],
    ["Messenger", "✉️"],
    ["Discover", "🌍"],
    ["Reels", "▶️"],
    ["Live Rooms", "🔴"],
    ["Profile", "👤"],
    ["Notifications", "🔔"]
  ];

  useEffect(() => {
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user || null);
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data: result, error }) => {
      if (!active) return;
      if (error) {
        setNotice("Login connection error: " + error.message);
        setUser(null);
      } else {
        setUser(result.session?.user || null);
      }
      setChecking(false);
    }).catch(error => {
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
        if (active) setNotice("Profile error: " + error.message);
      }
    }

    loadProfile();
    return () => { active = false; };
  }, [user]);

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
      let profileMap = {};

      if (postList.length > 0) {
        const userIds = [...new Set(postList.map(post => post.user_id).filter(Boolean))];

        if (userIds.length > 0) {
          const { data: people, error: profileError } = await supabase
            .from("profiles")
            .select("id, display_name, avatar_url")
            .in("id", userIds);

          if (!profileError) {
            (people || []).forEach(person => {
              profileMap[person.id] = person;
            });
          }
        }
      }

      setPosts(postList.map(post => ({
        ...post,
        author: profileMap[post.user_id]?.display_name || "Community Member",
        authorAvatar: profileMap[post.user_id]?.avatar_url || ""
      })));
    } catch (error) {
      setNotice("Posts loading error: " + error.message);
    } finally {
      setLoadingPosts(false);
    }
  }

  useEffect(() => {
    if (page === "Social Feed" && user) loadPosts();
  }, [page, user]);

  function openPage(name) {
    setPage(name);
    setNotice("");
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setNotice("Logout error: " + error.message);
      return;
    }
    setUser(null);
    setPage("Home");
    setProfile({
      display_name: "", bio: "", avatar_url: "", cover_url: ""
    });
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!user) {
      setNotice("Please login first.");
      return;
    }

    setSaving(true);
    setNotice("");

    try {
      const { error } = await supabase.from("profiles").upsert({
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
      const path = `${user.id}/${type}-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-media")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("profile-media").getPublicUrl(path);
      const url = data.publicUrl;
      const field = type === "avatar" ? "avatar_url" : "cover_url";

      const updated = {
        id: user.id,
        display_name: profile.display_name.trim(),
        bio: profile.bio.trim(),
        [field]: url,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from("profiles")
        .upsert(updated, { onConflict: "id" });

      if (error) throw error;

      setProfile(old => ({ ...old, [field]: url }));
      setNotice(type === "avatar" ? "Profile photo uploaded!" : "Cover photo uploaded!");
    } catch (error) {
      setNotice("Upload error: " + error.message);
    } finally {
      setUploading("");
    }
  }

  async function createPost(event) {
    event.preventDefault();

    if (!postText.trim() && !postFile) {
      setNotice("Please write something or select a photo/video.");
      return;
    }

    if (postFile && !(
      postFile.type.startsWith("image/") ||
      postFile.type.startsWith("video/")
    )) {
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

        const { data } = supabase.storage.from("post-media").getPublicUrl(path);
        mediaUrl = data.publicUrl;
        mediaType = postFile.type.startsWith("video/") ? "video" : "image";
      }

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        content: postText.trim(),
        media_url: mediaUrl,
        media_type: mediaType
      });

      if (error) throw error;

      setPostText("");
      setPostFile(null);
      const fileInput = document.getElementById("post-file-input");
      if (fileInput) fileInput.value = "";

      setNotice("Your post was published!");
      await loadPosts();
    } catch (error) {
      setNotice("Post error: " + error.message);
    } finally {
      setPosting(false);
    }
  }

  async function deletePost(post) {
    if (post.user_id !== user.id) {
      setNotice("You can only delete your own posts.");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this post?")) return;

    setDeletingPost(post.id);
    setNotice("");

    try {
      const { error } = await supabase.from("posts")
        .delete()
        .eq("id", post.id)
        .eq("user_id", user.id);

      if (error) throw error;

      if (post.media_url) {
        try {
          const marker = "/post-media/";
          const path = post.media_url.split(marker)[1];
          if (path) {
            await supabase.storage.from("post-media").remove([decodeURIComponent(path)]);
          }
        } catch (storageError) {
          console.log("Media cleanup issue:", storageError);
        }
      }

      setPosts(old => old.filter(item => item.id !== post.id));
      setNotice("Post deleted successfully.");
    } catch (error) {
      setNotice("Delete error: " + error.message);
    } finally {
      setDeletingPost("");
    }
  }

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
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">🌍</div>
          <div>
            <h2>GLOBAL <span>CONNECT</span></h2>
            <small>MEET THE WORLD</small>
          </div>
        </div>

        <div className="top-actions">
          <button className="icon-btn" onClick={() => openPage("Discover")}>🔍</button>
          <button className="icon-btn" onClick={() => openPage("Notifications")}>🔔</button>
          <button className="avatar" onClick={() => openPage("Profile")}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="Profile" style={styles.avatar} />
              : (user.email?.[0]?.toUpperCase() || "G")}
          </button>
          <button className="icon-btn" onClick={logout}>↪</button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <p className="menu-label">MAIN MENU</p>
          {menu.map(([name, emoji]) => (
            <button
              key={name}
              className={"nav-item " + (page === name ? "active" : "")}
              onClick={() => openPage(name)}
            >
              <span>{emoji}</span>
              <span>{name}</span>
            </button>
          ))}
          <div className="sidebar-bottom">
            <span>🛡️</span>
            <div><b>Safe Community</b><small>Connect respectfully</small></div>
          </div>
        </aside>

        <main className="content">
          {page === "Home" && (
            <>
              <section className="hero">
                <div className="hero-content">
                  <span className="eyebrow">✨ YOUR WORLD. YOUR PEOPLE.</span>
                  <h1>Meet The World.<br /><span>Make New Friends.</span></h1>
                  <p>Connect with people around the globe through video, audio and chat.</p>
                  <button className="primary-btn" onClick={() => openPage("Random Video")}>
                    📹 Start Meeting →
                  </button>
                </div>
                <div className="globe-art">🌍</div>
              </section>

              <div className="section-heading">
                <div><h2>Start Connecting</h2><p>Choose how you want to meet people</p></div>
                <span className="online-tag">● WORLDWIDE</span>
              </div>

              <div className="feature-grid">
                {[
                  ["Random Video", "📹", "Meet strangers face to face", "video-card"],
                  ["Random Audio", "📞", "Talk to someone new", "audio-card"],
                  ["Random Chat", "💬", "Start a conversation", "chat-card"],
                  ["Discover", "🌍", "Discover new connections", "friends-card"]
                ].map(([name, emoji, description, className]) => (
                  <button key={name} className={"feature-card " + className} onClick={() => openPage(name)}>
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
                <button className="outline-btn" onClick={() => openPage("Social Feed")}>Create Post</button>
              </div>
            </>
          )}

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
                    style={{ display: "block", marginTop: "10px" }}
                    onChange={event => setPostFile(event.target.files?.[0] || null)}
                  />
                </label>

                {postFile && (
                  <p style={styles.fileName}>Selected: {postFile.name}</p>
                )}

                <button className="primary-btn" type="submit" disabled={posting}>
                  {posting ? "Publishing..." : "🌍 Publish Post"}
                </button>
              </form>

              <div style={styles.feedHeading}>
                <h2>Community Posts</h2>
                <button className="outline-btn" onClick={loadPosts} disabled={loadingPosts}>
                  {loadingPosts ? "Loading..." : "↻ Refresh"}
                </button>
              </div>

              {loadingPosts && <p>Loading posts...</p>}

              {!loadingPosts && posts.length === 0 && (
                <div className="call-preview">
                  <h3>📰 No posts yet</h3>
                  <p>Be the first person to share something with the community!</p>
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
                          {post.created_at ? new Date(post.created_at).toLocaleString() : ""}
                        </small>
                      </div>
                    </div>

                    {post.content && <p style={styles.postContent}>{post.content}</p>}

                    {post.media_url && post.media_type === "video" && (
                      <video src={post.media_url} controls playsInline style={styles.postMedia} />
                    )}
                    {post.media_url && post.media_type !== "video" && (
                      <img src={post.media_url} alt="Community post" style={styles.postMedia} />
                    )}

                    {post.user_id === user.id && (
                      <button
                        style={styles.deleteButton}
                        disabled={deletingPost === post.id}
                        onClick={() => deletePost(post)}
                      >
                        {deletingPost === post.id ? "Deleting..." : "🗑️ Delete Post"}
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {page === "Random Video" && (
            <section className="work-panel">
              <h1>Random <span>Video Chat</span></h1>
              <div className="call-preview">
                <h3>📹 Ready to meet someone new?</h3>
                <p>Live video matching server is not connected yet.</p>
              </div>
              <button className="primary-btn" onClick={() => setNotice("Video calling will be enabled after the calling server is connected.")}>Start Video</button>
            </section>
          )}

          {page === "Random Audio" && (
            <section className="work-panel">
              <h1>Random <span>Audio Call</span></h1>
              <div className="call-preview">
                <h3>🎙️ Discover a new voice</h3>
                <p>Live audio calling server is not connected yet.</p>
              </div>
              <button className="primary-btn" onClick={() => setNotice("Audio calling will be enabled after the calling server is connected.")}>Start Audio Call</button>
            </section>
          )}

          {page === "Random Chat" && (
            <section className="work-panel">
              <h1>Random <span>Chat</span></h1>
              <div className="call-preview">
                <h3>💬 Your next conversation awaits</h3>
                <p>Random chat matching is not connected yet.</p>
              </div>
              <button className="primary-btn" onClick={() => setNotice("Random chat matching server is not connected yet.")}>Find Someone</button>
            </section>
          )}

          {page === "Messenger" && (
            <section className="work-panel">
              <h1>Your <span>Messenger</span></h1>
              <div className="call-preview">
                <h3>✉️ Your inbox</h3>
                <p>Private and group messaging will be connected in the next stage.</p>
              </div>
            </section>
          )}

          {page === "Discover" && (
            <section className="work-panel">
              <h1>Discover <span>People</span></h1>
              <div className="call-preview">
                <h3>🌍 Find new connections</h3>
                <p>People discovery will be connected in the next stage.</p>
              </d
