import React, { useState, useEffect } from 'react';
import styles from './LoadingScreen.module.css';

export default function LoadingScreen({ isVisible }) {
  const [phase, setPhase] = useState(0);

  const loadingTexts = [
    "Establishing secure connection to Replicon...",
    "Pulling Data Matrix & Timesheets...",
    "Processing Project Hierarchies...",
    "Finalizing Interface..."
  ];

  // Cycles through text phases while loading is active
  useEffect(() => {
    if (!isVisible) {
      setPhase(0); // Reset instantly when hidden
      return;
    }

    const interval = setInterval(() => {
      setPhase((prev) => {
        // Stop at the last text if the API is taking exceptionally long
        if (prev < loadingTexts.length - 1) return prev + 1;
        return prev; 
      });
    }, 2500); // Change text every 2.5 seconds to match the CSS animation

    return () => clearInterval(interval);
  }, [isVisible, loadingTexts.length]);

  if (!isVisible) return null;

  return (
    <div className={styles.overlay}>
      
      {/* Apple-style spinning glowing ring */}
      <div className={styles.spinner} />
      
      {/* Container for the text to prevent layout jumping */}
      <div className={styles.textContainer}>
        {/* The key={phase} forces the CSS animation to restart when text changes */}
        <h3 key={phase} className={styles.loadingText}>
          {loadingTexts[phase]}
        </h3>
      </div>
      
    </div>
  );
}