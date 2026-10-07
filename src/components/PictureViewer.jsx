import { useRef, useState } from 'react';
import { galleryPictures } from '../lib/data.js';
import { Icon } from './Decor.jsx';
import { play } from '../lib/sound.js';

/**
 * Picture(s) of one gallery item inside the existing lightbox.
 * One picture = exactly the old plain <img>. Several = a swipeable / scrollable strip (native scroll-snap,
 * so touch swipe, trackpad and mouse wheel all work) plus arrow buttons and a counter.
 */
export default function PictureViewer({ item }) {
  const pics = galleryPictures(item);
  const track = useRef(null);
  const [at, setAt] = useState(0);
  if (pics.length <= 1) return <img src={pics[0]?.url} alt={item.title} />;

  const go = (dir) => {
    const el = track.current; if (!el) return;
    play('tap');
    el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' });
  };
  const onScroll = (e) => {
    const el = e.currentTarget;
    setAt(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  };
  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  };

  return (
    <div className="viewer" role="group" aria-roledescription="carousel" aria-label={`รูปของ ${item.title}`}>
      <div className="viewer__track" ref={track} onScroll={onScroll} onKeyDown={onKey} tabIndex={0}>
        {pics.map((p, i) => (
          <div className="viewer__slide" key={p.key} role="group" aria-label={`รูปที่ ${i + 1} จาก ${pics.length}`}>
            <img src={p.url} alt={`${item.title} (${i + 1}/${pics.length})`} loading={i === 0 ? 'eager' : 'lazy'} />
          </div>
        ))}
      </div>
      <button type="button" className="viewer__nav viewer__nav--prev" aria-label="รูปก่อนหน้า" onClick={() => go(-1)} disabled={at <= 0}><Icon name="arrowLeft" size={20} /></button>
      <button type="button" className="viewer__nav viewer__nav--next" aria-label="รูปถัดไป" onClick={() => go(1)} disabled={at >= pics.length - 1}><Icon name="arrowRight" size={20} /></button>
      <div className="viewer__count" aria-live="polite">{at + 1} / {pics.length}</div>
    </div>
  );
}
