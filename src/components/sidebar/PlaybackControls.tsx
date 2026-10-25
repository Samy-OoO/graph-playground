import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { SPEED } from '../../constants';
import type { AlgorithmApi } from '../../hooks/useAlgorithm';
import { Button } from '../ui/Button';
import styles from './PlaybackControls.module.css';

interface PlaybackControlsProps {
  player: AlgorithmApi['player'];
  speed: number;
  onSpeedChange: (speed: number) => void;
}

export function PlaybackControls({ player, speed, onSpeedChange }: PlaybackControlsProps) {
  const lastIndex = player.steps.length - 1;

  return (
    <div className={styles.controls}>
      <div className={styles.progress}>
        <label htmlFor="step-scrubber">
          Step {player.index + 1} of {player.steps.length}
        </label>
        <input
          id="step-scrubber"
          type="range"
          min={0}
          max={lastIndex}
          value={player.index}
          onChange={(event) => player.seek(Number(event.target.value))}
        />
      </div>

      <div className={styles.buttons}>
        <Button icon={RotateCcw} aria-label="Back to the first step" onClick={player.reset} disabled={player.isFirst} />
        <Button icon={SkipBack} aria-label="Previous step" onClick={player.previous} disabled={player.isFirst} />
        <Button
          variant="primary"
          icon={player.isPlaying ? Pause : Play}
          aria-label={player.isPlaying ? 'Pause' : 'Play'}
          onClick={player.togglePlay}
        />
        <Button icon={SkipForward} aria-label="Next step" onClick={player.next} disabled={player.isLast} />
      </div>

      <div className={styles.speed}>
        <label htmlFor="playback-speed">Speed: {speed.toFixed(2).replace(/\.?0+$/, '')} steps/sec</label>
        <input
          id="playback-speed"
          type="range"
          min={SPEED.min}
          max={SPEED.max}
          step={SPEED.step}
          value={speed}
          onChange={(event) => onSpeedChange(Number(event.target.value))}
        />
        <div className={styles.speedLabels} aria-hidden="true">
          <span>Slow</span>
          <span>Fast</span>
        </div>
      </div>
    </div>
  );
}
