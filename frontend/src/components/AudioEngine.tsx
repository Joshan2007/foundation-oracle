'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

// Using Web Audio API to procedurally generate soundscapes and UI sounds
// without heavy external asset loading.

interface AudioContextType {
  isMuted: boolean;
  toggleMute: () => void;
  playHover: () => void;
  playClick: () => void;
  playSuccess: () => void;
  playAmbient: () => void;
}

const AudioEngineContext = createContext<AudioContextType>({
  isMuted: true,
  toggleMute: () => {},
  playHover: () => {},
  playClick: () => {},
  playSuccess: () => {},
  playAmbient: () => {},
});

export const useAudio = () => useContext(AudioEngineContext);

export const AudioEngineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMuted, setIsMuted] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  // Master gain controls global volume
  const masterGainRef = useRef<GainNode | null>(null);
  // Ambient gain controls just the background drone
  const ambientGainRef = useRef<GainNode | null>(null);

  // Initialize Audio Context on first interaction
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContext();
      
      masterGainRef.current = audioCtxRef.current.createGain();
      masterGainRef.current.connect(audioCtxRef.current.destination);
      
      // Initially muted
      masterGainRef.current.gain.value = 0;
      
      ambientGainRef.current = audioCtxRef.current.createGain();
      ambientGainRef.current.connect(masterGainRef.current);
      ambientGainRef.current.gain.value = 0; // Starts silent
    }
  };

  useEffect(() => {
    // Check local storage for user preference on mount
    const saved = localStorage.getItem('mythic_audio_muted');
    if (saved === 'false') {
      setIsMuted(false);
      // We can't automatically play audio until user gesture, 
      // but we set the state.
    }

    // Attach one-time interaction listeners to initialize audio
    const handleFirstInteraction = () => {
      initAudio();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  useEffect(() => {
    if (masterGainRef.current && audioCtxRef.current) {
      // Smooth fade in/out for mute toggle
      masterGainRef.current.gain.setTargetAtTime(
        isMuted ? 0 : 0.6, 
        audioCtxRef.current.currentTime, 
        0.1
      );
      localStorage.setItem('mythic_audio_muted', isMuted.toString());
    }
  }, [isMuted]);

  const toggleMute = () => {
    initAudio();
    setIsMuted(prev => !prev);
  };

  // 1. Play Hover Sound (High-tech subtle click)
  const playHover = () => {
    if (!audioCtxRef.current || isMuted) return;
    const ctx = audioCtxRef.current;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Very short click (glassy noise)
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.03);
    
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
    
    osc.connect(gain);
    gain.connect(masterGainRef.current!);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  };

  // 2. Play Click Sound (Slightly deeper confirmation)
  const playClick = () => {
    if (!audioCtxRef.current || isMuted) return;
    const ctx = audioCtxRef.current;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(masterGainRef.current!);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  };

  // 3. Play Success/Action Sound (Forge Chime)
  const playSuccess = () => {
    if (!audioCtxRef.current || isMuted) return;
    const ctx = audioCtxRef.current;
    
    // Play a chord (sci-fi chime)
    const freqs = [440, 554.37, 659.25]; // A4, C#5, E5 (A Major)
    
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05 + (i * 0.02));
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5 + (i * 0.2));
      
      osc.connect(gain);
      gain.connect(masterGainRef.current!);
      
      osc.start(ctx.currentTime + (i * 0.05));
      osc.stop(ctx.currentTime + 2.0);
    });
  };

  // 4. Start Ambient Loop (Disabled as per user request to keep only clicks)
  const playAmbient = () => {
    // No-op
  };

  useEffect(() => {
    // No longer playing ambient background drone
  }, [isMuted]);

  return (
    <AudioEngineContext.Provider value={{ isMuted, toggleMute, playHover, playClick, playSuccess, playAmbient }}>
      {children}
    </AudioEngineContext.Provider>
  );
};
