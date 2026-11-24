
import React, { useEffect, useRef, useState } from "react";

export default function CallSystem({ supabase, user, peer, onClose }) {
  const [incoming, setIncoming] = useState(null);
  const [status, setStatus] = useState("idle");
  const [callMode, setCallMode] = useState("video");
  const [error, setError] = useState("");
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const pcRef = useRef(null);
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const callIdRef = useRef(null);
  const remoteIdRef = useRef(null);
  const pendingIceRef = useRef([]);

  const peerId = peer?.id || peer?.user_id;

  async function sendSignal(to, eventType, payload = {}, callId = callIdRef.current) {
    if (!user?.id || !to || !callId) return;

    const { error } = await supabase.from("gc_call_signals").insert({
      call_id: callId,
      from_user_id: user.id,
      to_user_id: to,
      event_type: eventType,
      payload
    });

    if (error) throw error;
  }

  async function getMedia(mode) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: mode === "video"
    });
    localRef.current = stream;
    setLocalStream(stream);
    return stream;
  }

  function createConnection(remoteId, callId) {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ]
    });

    pcRef.current = pc;

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await sendSignal(remoteId, "ice", event.candidate.toJSON(), callId);
        } catch (e) {
          setError(e.message);
        }
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      remoteRef.current = stream;
      setRemoteStream(stream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setStatus("connected");
      if (["failed", "disconnected"].includes(pc.connectionState)) {
        setStatus("connection problem");
      }
    };

    return pc;
  }

  async function addPendingIce(pc) {
    for (const candidate of pendingIceRef.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {}
    }
    pendingIceRef.current = [];
  }

  async function startCall(mode) {
    if (!peerId || !user?.id) return;
    try {
      setError("");
      setCallMode(mode);
      setStatus("calling");

      const callId = crypto.randomUUID();
      callIdRef.current = callId;
      remoteIdRef.current = peerId;

      const stream = await getMedia(mode);
      const pc = createConnection(peerId, callId);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await sendSignal(peerId, "invite", {
        offer,
        mode,
        caller_name: user.user_metadata?.display_name || "GLOBAL CONNECT User"
      }, callId);
    } catch (e) {
      setError(e.message || "Call शुरू नहीं हो पाई");
      cleanup();
    }
  }

  async function acceptCall() {
    if (!incoming) return;
    try {
      setError("");
      const row = incoming;
      const callId = row.call_id;
      const remoteId = row.from_user_id;
      const mode = row.payload?.mode || "video";

      callIdRef.current = callId;
      remoteIdRef.current = remoteId;
      setCallMode(mode);
      setIncoming(null);
      setStatus("connecting");

      const stream = await getMedia(mode);
      const pc = createConnection(remoteId, callId);

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await pc.setRemoteDescription(
        new RTCSessionDescription(row.payload.offer)
      );

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await sendSignal(remoteId, "answer", { answer }, callId);
      await addPendingIce(pc);
    } catch (e) {
      setError(e.message || "Call स्वीकार नहीं हुई");
      cleanup();
    }
  }

  async function handleSignal(row) {
    const payload = row.payload || {};

    if (row.event_type === "invite") {
      if (status !== "idle" || incoming) {
        try {
          await sendSignal(row.from_user_id, "reject", {}, row.call_id);
        } catch {}
        return;
      }
      setIncoming(row);
      return;
    }

    if (row.call_id !== callIdRef.current) return;

    if (row.event_type === "answer" && pcRef.current) {
      await pcRef.current.setRemoteDescription(
        new RTCSessionDescription(payload.answer)
      );
      await addPendingIce(pcRef.current);
      setStatus("connecting");
    }

    if (row.event_type === "ice" && pcRef.current) {
      if (pcRef.current.remoteDescription) {
        try {
          await pcRef.current.addIceCandidate(
            new RTCIceCandidate(payload)
          );
        } catch {}
      } else {
        pendingIceRef.current.push(payload);
      }
    }

    if (["hangup", "reject"].includes(row.event_type)) {
      cleanup();
    }
  }

  useEffect(() => {
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
          handleSignal(row).catch(e => setError(e.message));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      cleanup();
    };
  }, [supabase, user?.id]);

  async function hangup() {
    try {
      if (remoteIdRef.current && callIdRef.current) {
        await sendSignal(remoteIdRef.current, "hangup");
      }
    } catch {}
    cleanup();
  }

  async function rejectCall() {
    if (incoming) {
      try {
        await sendSignal(
          incoming.from_user_id,
          "reject",
          {},
          incoming.call_id
        );
      } catch {}
    }
    setIncoming(null);
  }

  function cleanup() {
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (localRef.current) {
      localRef.current.getTracks().forEach(track => track.stop());
      localRef.current = null;
    }

    remoteRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIncoming(null);
    setStatus("idle");
    callIdRef.current = null;
    remoteIdRef.current = null;
    pendingIceRef.current = [];
  }

  const panel = {
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
    gap: 16
  };

  if (!user?.id) return null;

  if (incoming) {
    return (
      <div style={panel}>
        <h2>Incoming {incoming.payload?.mode || "video"} call</h2>
        <p>{incoming.payload?.caller_name || "GLOBAL CONNECT User"}</p>
        <button onClick={acceptCall}>Accept Call</button>
        <button onClick={rejectCall}>Reject Call</button>
        {error && <p>{error}</p>}
      </div>
    );
  }

  if (status !== "idle") {
    return (
      <div style={panel}>
        <h2>{peer?.display_name || peer?.name || "GLOBAL CONNECT Call"}</h2>
        <p>{status}</p>

        {callMode === "video" && (
          <video
            autoPlay
            playsInline
            muted
            ref={el => {
              if (el && localStream && el.srcObject !== localStream) {
                el.srcObject = localStream;
              }
            }}
            style={{ width: "45%", maxWidth: 220, borderRadius: 12 }}
          />
        )}

        {remoteStream && (
          <video
            autoPlay
            playsInline
            ref={el => {
              if (el && el.srcObject !== remoteStream) {
                el.srcObject = remoteStream;
              }
            }}
            style={{ width: "90%", maxWidth: 500, borderRadius: 12 }}
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

        {error && <p>{error}</p>}
        <button onClick={hangup}>End Call</button>
      </div>
    );
  }

  if (!peerId) return null;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button onClick={() => startCall("audio")}>Audio Call</button>
      <button onClick={() => startCall("video")}>Video Call</button>
      {error && <p>{error}</p>}
    </div>
  );
}
