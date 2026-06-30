import { useState, useEffect, useRef } from "react";

const loadingTexts = [
  "Polishing the leather...",
  "Setting the slip cordon...",
  "Rolling the pitch...",
  "Taking center guard...",
  "Checking third umpire...",
  "Tuning the DRS system...",
  "Marking run-up...",
  "Shining the match ball...",
  "Inspecting wickets...",
];

export function useLoadingState(isLoading: boolean, delay = 0, minimum = 800) {
  const [showLoader, setShowLoader] = useState(isLoading);
  const loadingStartTimeRef = useRef<number | null>(isLoading ? Date.now() : null);
  const delayTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (isLoading) {
      if (!showLoader && !delayTimeoutRef.current) {
        if (delay === 0) {
          setShowLoader(true);
          loadingStartTimeRef.current = Date.now();
        } else {
          delayTimeoutRef.current = setTimeout(() => {
            setShowLoader(true);
            loadingStartTimeRef.current = Date.now();
          }, delay);
        }
      }
    } else {
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
        delayTimeoutRef.current = null;
      }

      if (showLoader && loadingStartTimeRef.current !== null) {
        const elapsed = Date.now() - loadingStartTimeRef.current;
        const remaining = minimum - elapsed;
        if (remaining > 0) {
          const minTimeout = setTimeout(() => {
            setShowLoader(false);
            loadingStartTimeRef.current = null;
          }, remaining);
          return () => clearTimeout(minTimeout);
        } else {
          setShowLoader(false);
          loadingStartTimeRef.current = null;
        }
      } else {
        setShowLoader(false);
      }
    }

    return () => {
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
      }
    };
  }, [isLoading, showLoader, delay, minimum]);

  return showLoader;
}

export function CricketLoading({ message }: { message?: string }) {
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % loadingTexts.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] py-10 px-4 animate-fade-in">
      {/* Animation Area: Ball bouncing over stumps */}
      <div className="relative h-28 w-24 flex flex-col justify-end items-center mb-6">
        {/* Bouncing Cricket Ball */}
        <div className="cricket-ball-loader mb-2 z-10" />

        {/* Stumps / Wickets */}
        <div className="stumps-container mt-1">
          <div className="loading-bail-left" />
          <div className="loading-bail-right" />
          <div className="loading-stump" />
          <div className="loading-stump" />
          <div className="loading-stump" />
        </div>
      </div>

      {/* Loading message */}
      <div className="text-center">
        <h3 className="font-display text-xl text-primary tracking-wide uppercase animate-pulse">
          CREASELIVE
        </h3>
        <p className="text-xs text-muted-foreground mt-1.5 min-h-[16px] font-sans font-medium transition-all duration-300">
          {message || loadingTexts[textIndex]}
        </p>
      </div>
    </div>
  );
}

export function PageCricketLoading({ message }: { message?: string }) {
  return (
    <div className="fixed top-[62px] bottom-[80px] inset-x-0 z-20 bg-[#0A1628]/85 backdrop-blur-md flex items-center justify-center animate-fade-in">
      <div className="glass-card border border-border/40 p-10 rounded-3xl max-w-xs w-full shadow-2xl relative bg-elevated/70">
        <CricketLoading message={message} />
      </div>
    </div>
  );
}
