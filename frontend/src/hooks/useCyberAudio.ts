'use client';
import { useRef, useState } from 'react';

export function useCyberAudio() {
  const audioCtxMain = useRef<AudioContext | null>(null);
  const droneOscillator = useRef<OscillatorNode | null>(null);
  const droneGain = useRef<GainNode | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize the audio context
  const initAudio = () => {
    if (!audioCtxMain.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxMain.current = new AudioContext();
    }
    
    if (audioCtxMain.current.state === 'suspended') {
      audioCtxMain.current.resume();
    }

    if (!droneOscillator.current) {
      droneOscillator.current = audioCtxMain.current.createOscillator();
      droneGain.current = audioCtxMain.current.createGain();
      
      droneOscillator.current.type = 'sawtooth';
      droneOscillator.current.frequency.setValueAtTime(55, audioCtxMain.current.currentTime); // Low A

      droneGain.current.gain.setValueAtTime(0, audioCtxMain.current.currentTime);
      droneGain.current.gain.linearRampToValueAtTime(0.05, audioCtxMain.current.currentTime + 2); // very low volume

      const filter = audioCtxMain.current.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 200;

      droneOscillator.current.connect(filter);
      filter.connect(droneGain.current);
      droneGain.current.connect(audioCtxMain.current.destination);

      droneOscillator.current.start();
    }
    
    setIsInitialized(true);
  };

  const playClick = () => {
    if (!isInitialized || !audioCtxMain.current) return;
    const osc = audioCtxMain.current.createOscillator();
    const gain = audioCtxMain.current.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800 + Math.random() * 400, audioCtxMain.current.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtxMain.current.currentTime + 0.05);

    gain.gain.setValueAtTime(0.05, audioCtxMain.current.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtxMain.current.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(audioCtxMain.current.destination);
    osc.start();
    osc.stop(audioCtxMain.current.currentTime + 0.05);
  };

  const playBeam = () => {
    if (!isInitialized || !audioCtxMain.current) return;
    const osc = audioCtxMain.current.createOscillator();
    const gain = audioCtxMain.current.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, audioCtxMain.current.currentTime);
    osc.frequency.linearRampToValueAtTime(50, audioCtxMain.current.currentTime + 1.5);

    gain.gain.setValueAtTime(0.3, audioCtxMain.current.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtxMain.current.currentTime + 1.5);

    osc.connect(gain);
    gain.connect(audioCtxMain.current.destination);
    osc.start();
    osc.stop(audioCtxMain.current.currentTime + 1.5);
  };

  // Adjust drone based on scroll speed
  const setScrollVelocity = (velocity: number) => {
    if (!isInitialized || !droneOscillator.current || !audioCtxMain.current) return;
    const clamped = Math.min(Math.abs(velocity), 100);
    const targetFreq = 55 + (clamped * 1.5); // base 55Hz + speed
    droneOscillator.current.frequency.setTargetAtTime(targetFreq, audioCtxMain.current.currentTime, 0.1);
  };

  return { initAudio, isInitialized, playClick, playBeam, setScrollVelocity };
}
