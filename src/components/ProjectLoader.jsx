import React from 'react';
import styles from './ProjectLoader.module.css';

export default function ProjectLoader({ isVisible, step, currentItem, totalItems }) {
  if (!isVisible) return null;

  // Calculate percentage safely
  const percentage = totalItems > 0 ? Math.round((currentItem / totalItems) * 100) : 0;

  // Determine what text to show based on the current step
  let title = "Deploying Project";
  let showProgress = false;

  switch (step) {
    case 'client':
      title = "Adding Client...";
      break;
    case 'project':
      title = "Generating Project Structure...";
      break;
    case 'tasks':
      title = "Provisioning Tasks";
      showProgress = true;
      break;
    case 'resources':
      title = "Assigning Resources";
      showProgress = true;
      break;
    case 'finalizing':
      title = "Finalizing Deployment...";
      break;
    default:
      title = "Initializing...";
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.loaderBox}>
        <div className={styles.iconWrap}>
          <div className={styles.spinner}></div>
        </div>
        
        <h2 className={styles.stepText}>{title}</h2>
        <p className={styles.subText}>Please do not close this window.</p>

        {/* Dynamically render the progress bar only when needed */}
        {showProgress && (
          <div className={styles.progressContainer}>
            <div className={styles.progressHeader}>
              <span>{percentage}% Completed</span>
              <span className={styles.progressCounter}>
                [{currentItem} / {totalItems}]
              </span>
            </div>
            <div className={styles.progressTrack}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}