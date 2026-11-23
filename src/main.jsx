import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Auth from "./Auth";
import { supabase } from "./supabase";
import {
  Video, Phone, MessageCircle, Users, Home, User,
  Search, Bell, Globe, Image, Send, Compass,
  Radio, ShieldCheck, Sparkles, Play, Camera, Mic,
  Plus, LogOut, Save
} from "lucide-react";
import "./style.css";

function App() {
  const [page, setPage] = useState("Home");
  const [notice, setNotice] = useState("");
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  const [profile, setProfile] = useState({
    display_name: "",
    bio: ""
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setChecking(false);
    });

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    async function loadProfile() {
      setProfileLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, bio")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        setNotice("Profile load error: " + error.message);
      } else if (data) {
        setProfile({
          display_name: data.display_name || "",
          bio: data.bio || ""
        });
      }

      setProfileLoading(false);
    }

    loadProfile();
  }, [user]);

  const notify = (message) => setNotice(message);

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

  const openPage = (name) => {
    setPage(name);
    setNotice("");
  };

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) notify(error.message);
    else setPage("Home");
  }

  async function saveProfile(e) {
    e.preventDefault();
    if (!user) return;

    setProfileSaving(true);
    setNotice("");

    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          display_name: profile.display_name.trim(),
          bio: profile.bio.trim(),
          updated_at: new Date().toISOString()
        },
        { onConflict: "id" }
      );

    setProfileSaving(false);

    if (error) {
      notify("Profile save error: " + error.message);
    } else {
      notify("Your profile has been saved successfully!");
    }
  }

  if (checking) {
    return (
      <div className="app" style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center"
      }}>
        Loading GLOBAL CONNECT...
      </div>
    );
  }

  if (!user) {
    return <Auth onLogin={setUser} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><Globe /></div>
          <div>
            <h2>GLOBAL <span>CONNECT</span></h2>
            <small>MEET THE WORLD</small>
          </div>
        </div>

        <div className="top-actions">
          <button className="icon-btn" onClick={() => openPage("Discover")}>
            <Search />
          </button>
          <button className="icon-btn" onClick={() => openPage("Notifications")}>
            <Bell />
          </button>
          <button className="avatar" onClick={() => openPage("Profile")}>
            {user.email?.[0]?.toUpperCase() || "G"}
          </button>
          <button className="icon-btn" onClick={logout} title="Logout">
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
          {page === "Home" && <>
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
                  Connect with people around the globe through
                  live video, audio and chat.
                </p>
                <button className="primary-btn"
                  onClick={() => openPage("Random Video")}>
                  <Video size={19} /> Start Meeting <span>→</span>
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
              <button className="feature-card video-card"
                onClick={() => openPage("Random Video")}>
                <div className="feature-icon"><Video /></div>
                <h3>Random Video</h3>
                <p>Meet strangers face to face</p>
                <span className="feature-arrow">→</span>
              </button>

              <button className="feature-card audio-card"
                onClick={() => openPage("Random Audio")}>
                <div className="feature-icon"><Phone /></div>
                <h3>Random Audio</h3>
                <p>Talk to someone new</p>
                <span className="feature-arrow">→</span>
              </button>

              <button className="feature-card chat-card"
                onClick={() => openPage("Random Chat")}>
                <div className="feature-icon"><MessageCircle /></div>
                <h3>Random Chat</h3>
                <p>Start a conversation</p>
                <span className="feature-arrow">→</span>
              </button>

              <button className="feature-card friends-card"
                onClick={() => openPage("Discover")}>
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
              <button className="text-btn"
                onClick={() => openPage("Discover")}>
                Explore all →
              </button>
            </div>

            <div className="community-card">
              <div className="community-icon"><Image size={27} /></div>
              <div>
                <h3>Your social world starts here</h3>
                <p>Share photos, videos and moments with your community.</p>
              </div>
              <button className="outline-btn"
                onClick={() => openPage("Profile")}>
                Create Profile
              </button>
            </div>
          </>}

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
                <button className="primary-btn"
                  onClick={() => notify("Video calling requires the live calling server. It will be connected in the next development stage.")}>
                  <Video /> Start Video
                </button>
                <button className="outline-btn"
                  onClick={() => notify("Camera and microphone controls will be available when calling is connected.")}>
                  <Camera /> Camera
                </button>
              </div>
              <p className="safety-note">
                <ShieldCheck size={16} /> Be respectful. You can report or block users.
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
              <button className="primary-btn"
                onClick={() => notify("Live audio calling will be connected through our calling server.")}>
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
              <button className="primary-btn"
                onClick={() => notify("Random chat matching will be connected to the messaging server.")}>
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

          {page === "Profile" && (
            <section className="work-panel">
              <h1>Your <span>Profile</span></h1>

              <div className="profile-placeholder">
                <User size={55} />
              </div>

              <p>{user.email}</p>

              {profileLoading ? (
                <p>Loading your profile...</p>
              ) : (
                <form
                  onSubmit={saveProfile}
                  style={{
                    width: "100%",
                    maxWidth: "520px",
                    margin: "20px auto",
                    textAlign: "left"
                  }}
                >
                  <label style={{ display: "block", marginBottom: "8px" }}>
                    Display Name
                  </label>

                  <input
                    type="text"
                    value={profile.display_name}
                    onChange={(e) => setProfile({
                      ...profile,
                      display_name: e.target.value
                    })}
                    placeholder="Enter your name"
                    maxLength={60}
                    required
                    style={profileInputStyle}
                  />

                  <label style={{ display: "block", marginBottom: "8px" }}>
                    Bio
                  </label>

                  <textarea
                    value={profile.bio}
                    onChange={(e) => setProfile({
                      ...profile,
                      bio: e.target.value
                    })}
                    placeholder="Tell people something about yourself..."
                    maxLength={300}
                    rows={4}
                    style={profileInputStyle}
                  />

                  <button
                    className="primary-btn"
                    type="submit"
                    disabled={profileSaving}
                  >
                    <Save size={18} />
                    {profileSaving ? "Saving..." : "Save Profile"}
                  </button>

                  <p style={{
                    fontSize: "13px",
                    color: "#aab5cb",
                    marginTop: "15px"
                  }}>
                    Profile photo and cover photo upload will be added next.
                  </p>
                </form>
              )}
            </section>
          )}

          {page === "Discover" && (
            <section className="work-panel">
              <h1>Discover <span>People</span></h1>
              <p>Find new friends from around the world.</p>
              <div className="call-preview">
                <Compass size={48} />
                <h3>Explore the world</h3>
                <p>People discovery will appear here.</p>
              </div>
            </section>
          )}

          {page === "Reels" && (
            <section className="work-panel">
              <h1>Global <span>Reels</span></h1>
              <div className="call-preview">
                <Play size={48} />
                <h3>Short videos</h3>
                <p>Discover videos from the community.</p>
              </div>
            </section>
          )}

          {page === "Live Rooms" && (
            <section className="work-panel">
              <h1>Live <span>Rooms</span></h1>
              <div className="call-preview">
                <Radio size={48} />
                <h3>Join the conversation</h3>
                <p>Live audio and video rooms will be available here.</p>
              </div>
            </section>
          )}

          {page === "Notifications" && (
            <section className="work-panel">
              <h1>Your <span>Notifications</span></h1>
              <p>Updates and activity will appear here.</p>
            </section>
          )}

          {notice && (
            <div className="notice">
              <ShieldCheck size={18} />
              {notice}
              <button onClick={() => setNotice("")}>×</button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const profileInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "13px",
  marginBottom: "20px",
  borderRadius: "9px",
  border: "1px solid #344263",
  background: "#090d1c",
  color: "white",
  outline: "none",
  font: "inherit"
};

createRoot(document.getElementById("root")).render(<App />);
              
