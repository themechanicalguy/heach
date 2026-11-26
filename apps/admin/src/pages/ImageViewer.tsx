import { Button } from '@heach/ui';
import { useState } from 'react';
import { t } from '../i18n';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const QUARTER_TURN = 90;

interface Props {
  src: string;
  onClose: () => void;
}

/** A stored image (a document page or a photo) that a verifier can zoom and turn (AD-02). */
export function ImageViewer({ src, onClose }: Readonly<Props>) {
  const [zoom, setZoom] = useState(1);
  const [turn, setTurn] = useState(0);
  const zoomBy = (step: number) => {
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + step)));
  };
  const reset = () => {
    setZoom(1);
    setTurn(0);
  };
  return (
    <div className="admin-viewer" role="group" aria-label={t('verification.viewer.imageAlt')}>
      <div className="admin-viewer__bar">
        <Button
          className="heach-button--secondary"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => {
            zoomBy(ZOOM_STEP);
          }}
        >
          {t('verification.viewer.zoomIn')}
        </Button>
        <Button
          className="heach-button--secondary"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => {
            zoomBy(-ZOOM_STEP);
          }}
        >
          {t('verification.viewer.zoomOut')}
        </Button>
        <Button
          className="heach-button--secondary"
          onClick={() => {
            setTurn((current) => current - QUARTER_TURN);
          }}
        >
          {t('verification.viewer.rotateLeft')}
        </Button>
        <Button
          className="heach-button--secondary"
          onClick={() => {
            setTurn((current) => current + QUARTER_TURN);
          }}
        >
          {t('verification.viewer.rotateRight')}
        </Button>
        <Button className="heach-button--secondary" onClick={reset}>
          {t('verification.viewer.reset')}
        </Button>
        <Button className="heach-button--secondary" onClick={onClose}>
          {t('verification.close')}
        </Button>
      </div>
      <div className="admin-viewer__stage">
        <img
          className="admin-viewer__image"
          src={src}
          alt={t('verification.viewer.imageAlt')}
          style={{ transform: `scale(${String(zoom)}) rotate(${String(turn)}deg)` }}
        />
      </div>
    </div>
  );
}
