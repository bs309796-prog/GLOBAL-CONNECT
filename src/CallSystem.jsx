
import React, { useCallback, useEffect, useRef, useState } from "react";

export default function CallSystem({ supabase, user, peer, onClose }) {
  const [incoming, setIncoming] = useState(null);
  const [status, setStatus] = useState("idle");
  const [callMode, setCallMode] = useState("video");
  const [error, setError] = useState("");
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const pcRef = useRef(null);
  const localRef = useRef(null);
  const callIdRef = useRef(null);
  const remoteIdRef = useRef(null);
  const pendingIceRef = useRef([]);
  const incomingRef = useRef(null);
  const statusRef = useRef("idle");
  const handlerRef = useRef(null);
  const mountedRef = useRef(true);

  const peerId = peer?.id || peer?.user_id;

  const updateStatus = (value) => {
    statusRef.current = value;
    if (mountedRef.current) setStatus(value);
  };

  const sendSignal = async (to, eventType, payload = {}, callId = callIdRef.current) => {
    if (!user?.id || !to || !callId) {
      throw new Error("Call information missing");
    }

    const { error } = await supabase.from("gc_call_signals").insert({
      call_id: callId,
      from_user_id: user.id,
      to_user_id: to,
      event_type: eventType,
      payload
    });

    if (error) throw error;
  };

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (localRef.current) {
      localRef.current.getTracks().forEach(track => track.stop());
      localRef.current = null;
    }

    callIdRef.current = null;
    remoteIdRef.current = null;
    pendingIceRef.current = [];
    incomingRef.current = null;

    if (mountedRef.current) {
      setLocalStream(null);
      setRemoteStream(null);
      setIncoming(null);
      setError("");
    }

    updateStatus("idle");
  }, []);

  const getMedia = async (mode) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("इस ब्राउज़र में Audio/Video कॉल उपलब्ध नहीं है। HTTPS पर खोलें।");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: mode === "video"
    });

    localRef.current = stream;
    if (mountedRef.current) setLocalStream(stream);
    return stream;
  };

  const addPendingIce = async (pc) => {
    const candidates = [...pendingIceRef.current];
    pendingIceRef.current = [];

    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("ICE candidate error:", e);
      }
    }
  };

  const createConnection = (remoteId, callId) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ]
    });

    pcRef.current = pc;

    pc.onicecandidate = async (event) => {
      if (!event.candidate) return;

      try {
        await sendSignal(
          remoteId,
          "ice",
          event.candidate.toJSON(),
          callId
        );
      } catch (e) {
        if (mountedRef.current) setError(e.message);
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams?.[0];
      if (stream && mountedRef.current) {
        setRemoteStream(stream);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        updateStatus("connected");
      } else if (pc.connectionState === "connecting") {
        updateStatus("connecting");
      } else if (pc.connectionState === "failed") {
        updateStatus("connection failed");
        if (mountedRef.current) {
          setError("कॉल कनेक्ट नहीं हो पाई। दूसरे नेटवर्क से कोशिश करें।");
        }
      } else if (pc.connectionState === "disconnected") {
        updateStatus("disconnected");
      } else if (pc.connectionState === "closed") {
        updateStatus("idle");
      }
    };

    return pc;
  };

  const startCall = async (mode) => {
    if (!peerId || !user?.id || statusRef.current !== "idle") return;

    try {
      setError("");
      setCallMode(mode);
      updateStatus("calling");

      const callId = crypto.randomUUID();
      callIdRef.current = callId;
      remoteIdRef.current = peerId;

      const stream = await getMedia(mode);
      const pc = createConnection(peerId, callId);

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await sendSignal(peerId, "invite", {
        offer: pc.localDescription,
        mode,
        caller_name:
          user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          user.email ||
          "GLOBAL CONNECT User"
      }, callId);
    } catch (e) {
      setError(e.message || "Call शुरू नहीं हो पाई");
      cleanup();
    }
  };

  const acceptCall = async () => {
    const row = incomingRef.current;
    if (!row) return;

    try {
      setError("");

      const callId = row.call_id;
      const remoteId = row.from_user_id;
      const mode = row.payload?.mode || "video";

      callIdRef.current = callId;
      remoteIdRef.current = remoteId;
      setCallMode(mode);
      incomingRef.current = null;
      setIncoming(null);
      updateStatus("connecting");

      const stream = await getMedia(mode);
      const pc = createConnection(remoteId, callId);

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      await pc.setRemoteDescription(
        new RTCSessionDescription(row.payload.offer)
      );

      await addPendingIce(pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await sendSignal(remoteId, "answer", {
        answer: pc.localDescription
      }, callId);
    } catch (e) {
      setError(e.message || "Call स्वीकार नहीं हुई");
      cleanup();
    }
  };

  const rejectCall = async () => {
    const row = incomingRef.current;
    if (row) {
      try {
        await sendSignal(
          row.from_user_id,
          "reject",
          {},
          row.call_id
        );
      } catch (e) {
        console.warn(e);
      }
    }

    incomingRef.current = null;
    setIncoming(null);
    updateStatus("idle");
  };

  const handleSignal = async (row) => {
    if (!row || !row.event_type) return;

    const payload = row.payload || {};

    if (row.event_type === "invite") {
      if (
        statusRef.current !== "idle" ||
        incomingRef.current
      ) {
        try {
          await sendSignal(
            row.from_user_id,
            "reject",
            {},
            row.call_id
          );
        } catch {}
        return;
      }

      incomingRef.current = row;
      setIncoming(row);
      return;
    }

    if (row.call_id !== callIdRef.current) return;

    if (row.event_type === "answer" && pcRef.current) {
      if (!pcRef.current.remoteDescription) {
        await pcRef.current.setRemoteDescription(
          new RTCSessionDescription(payload.answer)
        );
        await addPendingIce(pcRef.current);
      }
      updateStatus("connecting");
      return;
    }

    if (row.event_type === "ice") {
      const pc = pcRef.current;

      if (pc?.remoteDescription) {
        try {
          await pc.addIceCandidate(
            new RTCIceCandidate(payload)
          );
        } catch (e) {
          console.warn("ICE error:", e);
        }
      } else {
        pendingIceRef.current.push(payload);
      }
      return;
    }

    if (["hangup", "reject"].includes(row.event_type)) {
      cleanup();
      return;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    handlerRef.current = handleSignal;

    if (!supabase || !user?.id) return;

    const channel = supabase
      .channel("gc-call-signals-" + user.id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "gc_call_signals",
          filter: "to_user_id=eq." + user.id
        },
        ({ new: row }) => {
          handlerRef.current?.(row).catch(e => {
            if (mountedRef.current) setError(e.message);
          });
        }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
      cleanup();
    };
  }, [supabase, user?.id, cleanup]);

  const hangup = async () => {
    try {
      if (remoteIdRef.current && callIdRef.current) {
        await sendSignal(remoteIdRef.current, "hangup");
      }
    } catch (e) {
      console.warn(e);
    }

    cleanup();
  };

  const closePanel = async () => {
    await hangup();
    onClose?.();
  };

  const panelStyle = {
    position: "fixed",
    inset: 0,
    zIndex: 99999,
    background: "#101827",
    color: "white",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 16,
    overflowY: "auto"
  };

  const buttonStyle = {
    padding: "12px 22px",
    border: 0,
    borderRadius: 10,
    background: "#2563eb",
    color: "white",
    fontWeight: 700,
    cursor: "pointer"
  };

  if (!user?.id) return null;

  if (incoming) {
    return (
      <div style={panelStyle}>
        <h2>Incoming {incoming.payload?.mode || "video"} call</h2>
        <p>
          {incoming.payload?.caller_name || "GLOBAL CONNECT User"}
        </p>

        <button style={buttonStyle} onClick={acceptCall}>
          Accept Call
        </button>

        <button
          style={{ ...buttonStyle, background: "#dc2626" }}
          onClick={rejectCall}
        >
          Reject Call
        </button>

        {error && <p>{error}</p>}
      </div>
    );
  }

  if (status !== "idle") {
    return (
      <div style={panelStyle}>
        <h2>
          {peer?.display_name || peer?.name || "GLOBAL CONNECT Call"}
        </h2>

        <p>Call status: {status}</p>

        {callMode === "video" && localStream && (
          <video
            autoPlay
            playsInline
            muted
            ref={el => {
              if (el && el.srcObject !== localStream) {
                el.srcObject = localStream;
              }
            }}
            style={{
              width: "45%",
              maxWidth: 220,
              borderRadius: 12,
              background: "#000"
            }}
          />
        )}

        {remoteStream && callMode === "video" && (
          <video
            autoPlay
            playsInline
            ref={el => {
              if (el && el.srcObject !== remoteStream) {
                el.srcObject = remoteStream;
              }
            }}
            style={{
              width: "90%",
              maxWidth: 600,
              borderRadius: 12,
              background: "#000"
            }}
          />
        )}

        {remoteStream && callMode === "audio" && (
          <audio
            autoPlay
            ref={el => {
              if (el && el.srcObject !== remoteStream) {
                el.srcObject = remoteStream;
              }
            }}
          />
        )}

        {error && <p style={{ color: "#fca5a5" }}>{error}</p>}

        <button
          style={{ ...buttonStyle, background: "#dc2626" }}
          onClick={hangup}
        >
          End Call
        </button>
      </div>
    );
  }

  if (!peerId) return null;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button
        style={buttonStyle}
        onClick={() => startCall("audio")}
      >
        Audio Call
      </button>

      <button
        style={buttonStyle}
        onClick={() => startCall("video")}
      >
        Video Call
      </button>

      {error && <p style={{ color: "#fca5a5" }}>{error}</p>}
    </div>
  );
}
