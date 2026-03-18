
export interface TrainingVideo {
  id: string;
  title: string;
  duration: string;
  topic: string;
  embedUrl: string;
  url: string;
}

interface TrainingVideosModalProps {
  open: boolean;
  onClose: () => void;
  videos: TrainingVideo[];
  selectedVideoId: string;
  onSelectVideo: (id: string) => void;
}

const TrainingVideosModal = ({
  open,
  onClose,
  videos,
  selectedVideoId,
  onSelectVideo,
}: TrainingVideosModalProps) => {
  if (!open) return null;
  const selectedVideo = videos.find((v) => v.id === selectedVideoId) || videos[0];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Training videos"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2460,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: '20px 24px',
          width: 'min(78vw, 1080px)',
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Training Videos</h2>
            <div style={{ marginTop: 4, fontSize: 12, color: '#5f6b7a' }}>
              Open a lesson to review workflows inside the app.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}
            aria-label="Close training videos"
          >
            ×
          </button>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(260px, 320px) 1fr',
            gap: 14,
            overflow: 'hidden',
            minHeight: 0,
            flex: 1,
          }}
        >
          <div style={{ overflowY: 'auto', paddingRight: 6 }}>
            {videos.map((video) => (
              <button
                key={video.id}
                onClick={() => onSelectVideo(video.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: video.id === selectedVideo?.id ? '1px solid #1976d2' : '1px solid #d0d7e2',
                  background: video.id === selectedVideo?.id ? '#eef5ff' : '#fff',
                  cursor: 'pointer',
                  marginBottom: 8,
                }}
              >
                <div style={{ fontWeight: 700, color: '#1f2d3d' }}>{video.title}</div>
                <div style={{ fontSize: 12, color: '#4d627a', marginTop: 3 }}>{video.topic}</div>
                <div style={{ fontSize: 12, color: '#7a8796', marginTop: 4 }}>
                  Duration: {video.duration}
                </div>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {selectedVideo ? (
              <>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{selectedVideo.title}</div>
                <div style={{ color: '#4d627a', fontSize: 13, marginBottom: 10 }}>
                  {selectedVideo.topic}
                </div>
                <div style={{ flex: 1, minHeight: 260, border: '1px solid #d0d7e2', borderRadius: 10, overflow: 'hidden', background: '#000' }}>
                  <iframe
                    title={selectedVideo.title}
                    src={selectedVideo.embedUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0, minHeight: 260 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
                <div style={{ marginTop: 10 }}>
                  <a
                    href={selectedVideo.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#1976d2', fontWeight: 600 }}
                  >
                    Open in YouTube
                  </a>
                </div>
              </>
            ) : (
              <div style={{ color: '#555' }}>No videos configured.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainingVideosModal;
