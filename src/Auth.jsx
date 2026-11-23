import React, { useState } from "react";
import { supabase } from "./supabase";

export default function Auth({ onLogin }) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const result = isSignup
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      if (result.error) throw result.error;

      if (isSignup && !result.data.session) {
        setMessage("Signup successful! Please check your email to verify your account.");
      } else {
        setMessage("Login successful!");
        if (onLogin) onLogin(result.data.user);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#090d1c",
      padding: "20px",
      color: "white"
    }}>
      <form onSubmit={handleSubmit} style={{
        width: "100%",
        maxWidth: "400px",
        padding: "30px",
        borderRadius: "18px",
        background: "#141d33",
        border: "1px solid #293652"
      }}>
        <h1 style={{ textAlign: "center", marginBottom: "10px" }}>
          GLOBAL <span style={{ color: "#9d8bff" }}>CONNECT</span>
        </h1>

        <p style={{
          textAlign: "center",
          color: "#aab5cb",
          marginBottom: "25px"
        }}>
          {isSignup ? "Create your account" : "Welcome back"}
        </p>

        <label>Email Address</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          style={inputStyle}
        />

        <label>Password</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password (minimum 6 characters)"
          style={inputStyle}
        />

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Please wait..." : isSignup ? "Create Account" : "Login"}
        </button>

        {message && (
          <p style={{
            color: "#a99aff",
            marginTop: "15px",
            fontSize: "13px",
            textAlign: "center"
          }}>
            {message}
          </p>
        )}

        <p style={{
          textAlign: "center",
          marginTop: "22px",
          color: "#aab5cb",
          fontSize: "13px"
        }}>
          {isSignup ? "Already have an account?" : "New to GLOBAL CONNECT?"}
          <button
            type="button"
            onClick={() => {
              setIsSignup(!isSignup);
              setMessage("");
            }}
            style={{
              color: "#a99aff",
              background: "none",
              marginLeft: "6px",
              fontWeight: "bold"
            }}
          >
            {isSignup ? "Login" : "Sign Up"}
          </button>
        </p>
      </form>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "13px",
  margin: "9px 0 20px",
  borderRadius: "9px",
  border: "1px solid #344263",
  background: "#090d1c",
  color: "white",
  outline: "none"
};

const buttonStyle = {
  width: "100%",
  padding: "14px",
  borderRadius: "9px",
  background: "linear-gradient(100deg, #7958ff, #5269ef)",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  border: "none"
};
