
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Auth from "./Auth.jsx";
import { supabase } from "./supabase.js";
import {
  Video,
  Phone,
  MessageCircle,
  Users,
  Home,
  User,
  Search,
  Bell,
  Globe,
  Image,
  Send,
  Compass,
  Radio,
  ShieldCheck,
  Sparkles,
  Play,
  Camera,
  Mic,
  LogOut,
  Save,
  ImagePlus
} from "lucide-react";
import "./style.css";

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
        <div style={errorScreenStyle}>
          <h2>GLOBAL CONNECT Error</h2>
          <p>{this.state.error.message}</p>
          <button
            style={errorButtonStyle}
            onClick={() => window.location.reload()}
          >
            Reload Website
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [page, setPage] = useState("Home");
  const [notice, setNotice] = useState("");
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [uploading, setUploading] = useState("");

  const [profile, setProfile] = useState({
    display_name: "",
    bio: "",
    avatar_url: "",
    cover_url: ""
  });

  const notify = (message) => setNotice(message);

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setChecking(false);
      }
    });

    async function checkSession() {
      let timeoutId;

      try {
        const timeout = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new Error("Connection timed out. Please reload the website.")
            );
          }, 12000);
        });

        const result = await Promise.race([
          supabase.auth.getSession(),
          timeout
        ]);

        clearTimeout(timeoutId);

        if (result.error) {
          throw result.error;
        }

        if (mounted) {
          setUser(result.data.session?.user ?? null);
          setChecking(false);
        }
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        console.error("Session error:", error);

        if (mounted) {
          setUser(null);
          setChecking(false);
          setNotice(
            "Login connection error: " +
              (error.message || "Please reload the website.")
          );
        }
      }
    }

    checkSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProfileLoading(false);
      return;
    }

    let mounted = true;

    async function loadProfile() {
      setProfileLoading(true);

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("display_name, bio, avatar_url, cover_url")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (mounted && data) {
          setProfile({
            display_name: data.display_name || "",
            bio: data.bio || "",
            avatar_url: data.avatar_url || "",
            cover_url: data.cover_url || ""
          });
        }
      } catch (error) {
        console.error("Profile loading error:", error);
        if (mounted) {
          notify("Profile load error: " + error.message);
        }
      } finally {
        if (mounted) {
          setProfileLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [user]);

  const menu = [
    ["Home", Home],
    ["Random Video", Video],
    ["Random Audio", Phone],
    ["Random Chat", MessageCircle],
    ["Messenger", Send],
    ["Discover", Compass],
    ["Reels", Play],
    ["Live Rooms", Radio],
    ["Profile", User]
  ];

  function openPage(name) {
    setPage(name);
    setNotice("");
  }

  async function logout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setPage("Home");
      setProfile({
        display_name: "",
        bio: "",
        avatar_url: "",
        cover_url: ""
      });
      notify("You have logged out successfully.");
    } catch (error) {
      notify("Logout error: " + error.message);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();

    if (!user) {
      notify("Please login first.");
      return;
    }

    setProfileSaving(true);
    setNotice("");

    try {
      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            display_name: profile.display_name.trim(),
            bio: profile.bio.trim(),
            avatar_url: profile.avatar_url,
            cover_url: profile.cover_url,
            updated_at: new Date().toISOString()
          },
          { onConflict: "id" }
        );

      if (error) throw error;

      notify("Your profile has been saved successfully!");
    } catch (error) {
      notify("Profile save error: " + error.message);
    } finally {
      setProfileSaving(false);
    }
  }

  async function uploadProfileImage(file, imageType) {
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      notify("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      notify("Image size must be less than 5 MB.");
      return;
    }

    setUploading(imageType);
    setNotice("");

    try {
      const extension = file.name.split(".").pop().toLowerCase();
      const filePath =
        `${user.id}/${imageType}-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-media")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from("profile-media")
        .getPublicUrl(filePath);

      const imageUrl = publicData.publicUrl;
      const columnName =
        imageType === "avatar" ? "avatar_url" : "cover_url";

      const updatedProfile = {
        id: user.id,
        display_name: profile.display_name.trim(),
        bio: profile.bio.trim(),
        [columnName]: imageUrl,
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from("profiles")
        .upsert(updatedProfile, { onConflict: "id" });

      if (updateError) throw updateError;

      setProfile((previous) => ({
        ...previous,
        [columnName]: imageUrl
      }));

      notify(
        imageType === "avatar"
          ? "Profile photo uploaded successfully!"
          : "Cover photo uploaded successfully!"
      );
    } catch (error) {
      console.error("Image upload error:", error);
      notify("Image upload error: " + error.message);
    } finally {
      setUploading("");
    }
  }

  if (checking) {
    return (
      <div className="app" style={loadingStyle}>
        <Globe size={45} />
        <h2>GLOBAL CONNECT</h2>
        <p>Connecting to your account...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Auth onLogin={setUser} />
        {notice && (
          <div style={floatingNoticeStyle}>
            {notice}
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Globe />
          </div>
          <div>
            <h2>GLOBAL <span>CONNECT</span></h2>
            <small>MEET THE WORLD</small>
          </div>
        </div>

        <div className="top-actions">
          <button
            className="icon-btn"
            onClick={() => openPage("Discover")}
            aria-label="Search"
          >
            <Search />
          </button>

          <button
            className="icon-btn"
            onClick={() => openPage("Notifications")}
            aria-label="Notifications"
          >
            <Bell />
          </button>

          <button
            className="avatar"
            onClick={() => openPage("Profile")}
            aria-label="Profile"
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" style={avatarStyle} />
            ) : (
              user.email?.[0]?.toUpperCase() || "G"
            )}
          </button>

          <button
            className="icon-btn"
            onClick={logout}
            title="Logout"
            aria-label="Logout"
          >
            <LogOut />
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <p className="menu-label">MAIN MENU</p>

          {menu.map(([name, Icon]) => (
            <button
              key={name}
              className={"nav-item " + (page === name ? "active" : "")}
              onClick={() => openPage(name)}
            >
              <Icon size={19} />
              <span>{name}</span>
            </button>
          ))}

          <div className="sidebar-bottom">
            <ShieldCheck size={20} />
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
                  <span className="eyebrow">
                    <Sparkles size={14} /> YOUR WORLD. YOUR PEOPLE.
                  </span>

                  <h1>
                    Meet The World.<br />
                    <span>Make New Friends.</span>
                  </h1>

                  <p>
                    Connect with people around the globe through live video,
                    audio and chat.
                  </p>

                  <button
                    className="primary-btn"
                    onClick={() => openPage("Random Video")}
                  >
                    <Video size={19} />
                    Start Meeting
                    <span>→</span>
                  </button>
                </div>

                <div className="globe-art">
                  <Globe size={145} />
                  <div className="orbit orbit-one"></div>
                  <div className="orbit orbit-two"></div>
                </div>
              </section>

              <div className="section-heading">
                <div>
                  <h2>Start Connecting</h2>
                  <p>Choose how you want to meet people</p>
                </div>
                <span className="online-tag">● WORLDWIDE</span>
              </div>

              <div className="feature-grid">
                <button
                  className="feature-card video-card"
                  onClick={() => openPage("Random Video")}
                >
                  <div className="feature-icon"><Video /></div>
                  <h3>Random Video</h3>
                  <p>Meet strangers face to face</p>
                  <span className="feature-arrow">→</span>
                </button>

                <button
                  className="feature-card audio-card"
                  onClick={() => openPage("Random Audio")}
                >
                  <div className="feature-icon"><Phone /></div>
                  <h3>Random Audio</h3>
                  <p>Talk to someone new</p>
                  <span className="feature-arrow">→</span>
                </button>

                <button
                  className="feature-card chat-card"
                  onClick={() => openPage("Random Chat")}
                >
                  <div className="feature-icon"><MessageCircle /></div>
                  <h3>Random Chat</h3>
                  <p>Start a conversation</p>
                  <span className="feature-arrow">→</span>
                </button>

                <button
                  className="feature-card friends-card"
                  onClick={() => openPage("Discover")}
                >
                  <div className="feature-icon"><Users /></div>
                  <h3>Find Friends</h3>
                  <p>Discover new connections</p>
                  <span className="feature-arrow">→</span>
                </button>
              </div>

              <div className="section-heading">
                <div>
                  <h2>Explore Community</h2>
                  <p>See what's happening around the world</p>
                </div>
                <button
                  className="text-btn"
                  onClick={() => openPage("Discover")}
                >
                  Explore all →
                </button>
              </div>

              <div className="community-card">
                <div className="community-icon">
                  <Image size={27} />
                </div>
                <div>
                  <h3>Your social world starts here</h3>
                  <p>
                    Share photos, videos and moments with your community.
                  </p>
                </div>
                <button
                  className="outline-btn"
                  onClick={() => openPage("Profile")}
                >
                  Create Profile
                </button>
              </div>
            </>
          )}

          {page === "Random Video" && (
            <section className="work-panel">
              <span className="eyebrow">
                <Globe size={14} /> GLOBAL VIDEO NETWORK
              </span>
              <h1>Random <span>Video Chat</span></h1>
              <p>Meet new people from different countries.</p>

              <div className="call-preview">
                <Video size={52} />
                <h3>Ready to meet someone new?</h3>
                <p>Your video connection will appear here.</p>
              </div>

              <div className="control-row">
                <button
                  className="primary-btn"
                  onClick={() =>
                    notify(
                      "Video calling requires the live calling server. It will be connected in the next development stage."
                    )
                  }
                >
                  <Video /> Start Video
                </button>
                <button
                  className="outline-btn"
                  onClick={() =>
                    notify(
                      "Camera and microphone controls will be available when calling is connected."
                    )
                  }
                >
                  <Camera /> Camera
                </button>
              </div>

              <p className="safety-note">
                <ShieldCheck size={16} />
                Be respectful. You can report or block users.
              </p>
            </section>
          )}

          {page === "Random Audio" && (
            <section className="work-panel">
              <span className="eyebrow">GLOBAL AUDIO NETWORK</span>
              <h1>Random <span>Audio Call</span></h1>
              <div className="call-preview">
                <Mic size={52} />
                <h3>Discover a new voice</h3>
                <p>Connect with people around the world.</p>
              </div>
              <button
                className="primary-btn"
                onClick={() =>
                  notify(
                    "Live audio calling will be connected through our calling server."
                  )
                }
              >
                <Phone /> Start Audio Call
              </button>
            </section>
          )}

          {page === "Random Chat" && (
            <section className="work-panel">
              <span className="eyebrow">MEET SOMEONE NEW</span>
              <h1>Random <span>Chat</span></h1>
              <div className="call-preview">
                <MessageCircle size={52} />
                <h3>Your next conversation awaits</h3>
                <p>Chat with new people worldwide.</p>
              </div>
              <button
                className="primary-btn"
                onClick={() =>
                  notify(
                    "Random chat matching will be connected to the messaging server."
                  )
                }
              >
                <MessageCircle /> Find Someone
              </button>
            </section>
          )}

          {page === "Messenger" && (
            <section className="work-panel">
              <h1>Your <span>Messenger</span></h1>
              <p>Your private and group conversations will appear here.</p>
              <div className="call-preview">
                <Send size={45} />
                <h3>Your inbox is ready</h3>
                <p>Start making connections to begin chatting.</p>
              </div>
            </section>
          )}

          {page === "Discover" && (
            <section className="work-panel">
              <h1>Discover <span>People</span></h1>
              <p>Find and connect with people around the world.</p>
              <div className="call-preview">
                <Compass size={48} />
                <h3>Discover new connections</h3>
                <p>People discovery will be connected in the next development stage.</p>
              </div>
            </section>
          )}

          {page === "Reels" && (
            <section className="work-panel">
              <h1>Global <span>Reels</span></h1>
              <p>Short videos from your community will appear here.</p>
              <div className="call-preview">
                <Play size={48} />
                <h3>Your video feed is coming</h3>
                <p>Reels and video uploads will be connected in a later stage.</p>
              </div>
            </section>
          )}

          {page === "Live Rooms" && (
            <section className="work-panel">
              <h1>Live <span>Rooms</span></h1>
              <p>Join group conversations and meet new people.</p>
              <div className="call-preview">
                <Radio size={48} />
                <h3>Live rooms are coming</h3>
                <p>Group audio and video rooms need the live calling service.</p>
              </div>
            </section>
          )}

          {page === "Notifications" && (
            <section className="work-panel">
              <h1>Your <span>Notifications</span></h1>
              <p>Updates and activity will appear here.</p>
              <div className="call-preview">
                <Bell size={45} />
                <h3>No new notifications</h3>
                <p>You'll see updates here when people interact with you.</p>
              </div>
            </section>
          )}

          {page === "Profile" && (
            <section className="work-panel">
              <h1>Your <span>Profile</span></h1>

              {profileLoading ? (
                <p>Loading your profile...</p>
              ) : (
                <>
                  <div style={coverStyle}>
                    {profile.cover_url && (
                      <img
                        src={profile.cover_url
