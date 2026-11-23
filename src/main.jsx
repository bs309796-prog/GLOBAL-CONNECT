
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

  const menu = [
    ["Home", "🏠"],
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

    const { data } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (active) {
          setUser(session?.user || null);
          setChecking(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: result, error }) => {
      if (!active) return;

      if (error) {
        setNotice("Login connection error: " + error.message);
        setUser(null);
      } else {
        setUser(result.session?.user || null);
      }

      setChecking(false);
    }).catch((error) => {
      if (!active) return;
      setNotice("Connection error: " + error.message);
      setChecking(false);
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
      display_name: "",
      bio: "",
      avatar_url: "",
      cover_url: ""
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
        .upload(path, file, {
          upsert: true,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("profile-media")
        .getPublicUrl(path);

      const url = data.publicUrl;
      const field = type === "avatar" ? "avatar_url" : "cover_url";

      const updated = {
        id: user.id,
        display_name: profile.display_name.trim(),
        bio: profile.bio.trim(),
        [field]: url,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from("profiles")
        .upsert(updated, { onConflict: "id" });

      if (error) throw error;

      setProfile((old) => ({ ...old, [field]: url }));
      setNotice(type === "avatar"
        ? "Profile photo uploaded!"
        : "Cover photo uploaded!");
    } catch (error) {
      setNotice("Upload error: " + error.message);
    } finally {
      setUploading("");
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
          <button className="icon-btn" onClick={() => openPage("Discover")}>
            🔍
          </button>
          <button className="icon-btn" onClick={() => openPage("Notifications")}>
            🔔
          </button>
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
            <div>
              <b>Safe Community</b>
              <small>Connect respectfully</small>
            </div>
          </div>
        </aside>

        <main className="content">
          {page === "Home" && (
            <>
              <section className="hero">
                <div className="hero-content">
                  <span className="eyebrow">✨ YOUR WORLD. YOUR PEOPLE.</span>
                  <h1>
                    Meet The World.<br />
                    <span>Make New Friends.</span>
                  </h1>
                  <p>
                    Connect with people around the globe through video,
                    audio and chat.
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
                <button className="outline-btn" onClick={() => openPage("Profile")}>
                  Create Profile
                </button>
              </div>
            </>
          )}

          {page === "Random Video" && (
            <section className="work-panel">
              <h1>Random <span>Video Chat</span></h1>
              <div className="call-preview">
                <h3>📹 Ready to meet someone new?</h3>
                <p>Live video matching server is not connected yet.</p>
              </div>
              <button className="primary-btn" onClick={() =>
                setNotice("Video calling will be enabled after the calling server is connected.")
              }>
                Start Video
              </button>
            </section>
          )}

          {page === "Random Audio" && (
            <section className="work-panel">
              <h1>Random <span>Audio Call</span></h1>
              <div className="call-preview">
                <h3>🎙️ Discover a new voice</h3>
                <p>Live audio calling server is not connected yet.</p>
              </div>
              <button className="primary-btn" onClick={() =>
                setNotice("Audio calling will be enabled after the calling server is connected.")
              }>
                Start Audio Call
              </button>
            </section>
          )}

          {page === "Random Chat" && (
            <section className="work-panel">
              <h1>Random <span>Chat</span></h1>
              <div className="call-preview">
                <h3>💬 Your next conversation awaits</h3>
                <p>Random chat matching is not connected yet.</p>
              </div>
              <button className="primary-btn" onClick={() =>
                setNotice("Random chat matching server is not connected yet.")
              }>
                Find Someone
              </button>
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
              </div>
            </section>
          )}

          {page === "Reels" && (
            <section className="work-panel">
              <h1>Global <span>Reels</span></h1>
              <div className="call-preview">
                <h3>▶️ Short videos</h3>
                <p>Your community video feed will be connected in the next stage.</p>
              </div>
            </section>
          )}

          {page === "Live Rooms" && (
            <section className="work-panel">
              <h1>Live <span>Rooms</span></h1>
              <div className="call-preview">
                <h3>🔴 Join the conversation</h3>
                <p>Group audio and video rooms will be connected in the next stage.</p>
              </div>
            </section>
          )}

          {page === "Notifications" && (
            <section className="work-panel">
              <h1>Your <span>Notifications</span></h1>
              <div className="call-preview">
                <h3>🔔 Notifications</h3>
                <p>Your updates will appear here.</p>
              </div>
            </section>
          )}

          {page === "Profile" && (
            <section className="work-panel">
              <h1>Your <span>Profile</span></h1>

              <div style={styles.cover}>
                {profile.cover_url && (
                  <img
                    src={profile.cover_url}
                    alt="Cover"
                    style={styles.coverImage}
                  />
                )}
              </div>

              <label style={styles.uploadLabel}>
                {uploading === "cover" ? "Uploading cover..." : "Change Cover Photo"}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={!!uploading}
                  onChange={(event) => {
                    uploadImage(event.target.files?.[0], "cover");
                    event.target.value = "";
                  }}
                />
              </label>

              <div style={styles.profilePhoto}>
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt="Profile" style={styles.profileImage} />
                  : "👤"}
              </div>

              <label style={styles.uploadLabel}>
                {uploading === "avatar" ? "Uploading photo..." : "Change Profile Photo"}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={!!uploading}
                  onChange={(event) => {
                    uploadImage(event.target.files?.[0], "avatar");
                    event.target.value = "";
                  }}
                />
              </label>

              <form onSubmit={saveProfile} style={styles.form}>
                <label>Email Address</label>
                <input type="email" value={user.email || ""} disabled />

                <label>Display Name</label>
                <input
                  type="text"
                  value={profile.display_name}
                  maxLength={60}
                  placeholder="Enter your name"
                  onChange={(event) => setProfile({
                    ...profile,
                    display_name: event.target.value
                  })}
                />

                <label>Bio</label>
                <textarea
                  rows={4}
                  maxLength={300}
                  value={profile.bio}
                  placeholder="Tell people something about yourself..."
                  onChange={(event) => setProfile({
                    ...profile,
                    bio: event.target.value
                  })}
                />

                <button className="primary-btn" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "💾 Save Profile"}
                </button>
              </form>
            </section>
          )}

          {notice && (
            <div className="notice">
              <span>🛡️ {notice}</span>
              <button onClick={() => setNotice("")}>×</button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const styles = {
  loading: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#090d1c",
    color: "white"
  },
  error: {
    minHeight: "100vh",
    padding: "25px",
    background: "#090d1c",
    color: "white",
    textAlign: "center"
  },
  notice: {
    position: "fixed",
    bottom: "15px",
    left: "15px",
    right: "15px",
    padding: "14px",
    borderRadius: "10px",
    background: "#202b43",
    color: "white",
    zIndex: 9999
  },
  avatar: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "50%"
  },
  cover: {
    width: "100%",
    height: "180px",
    marginTop: "20px",
    borderRadius: "14px",
    overflow: "hidden",
    background: "linear-gradient(120deg, #263a68, #7157a8)"
  },
  coverImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover"
  },
  profilePhoto: {
    width: "100px",
    height: "100px",
    marginTop: "15px",
    borderRadius: "50%",
    overflow: "hidden",
    background: "#293652",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "40px"
  },
  profileImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover"
  },
  uploadLabel: {
    display: "inline-block",
    margin: "12px 12px 12px 0",
    padding: "10px 14px",
    borderRadius: "8px",
    background: "#293652",
    color: "white",
    cursor: "pointer"
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    maxWidth: "620px",
    marginTop: "20px"
  }
};

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
