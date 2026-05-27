export type RotationAngle = 0 | 90 | 180 | 270;

export interface VideoRotationInfo {
  angle: RotationAngle;
  needsCorrection: boolean;
  transform: string;
  containerStyle: {
    transform: string;
    width?: string;
    height?: string;
  };
}

export async function extractVideoRotation(file: File): Promise<RotationAngle> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    video.onloadedmetadata = () => {
      try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        video.currentTime = 0.1;
      } catch (error) {
        console.error('Error loading video metadata:', error);
        resolve(0);
      }
    };

    video.onseeked = () => {
      try {
        if (!ctx) {
          resolve(0);
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const aspectRatio = video.videoWidth / video.videoHeight;

        if (aspectRatio < 1 && isLikelyLandscapeContent(video)) {
          resolve(90);
        } else if (aspectRatio > 1 && isLikelyPortraitContent(video)) {
          resolve(270);
        } else {
          resolve(0);
        }
      } catch (error) {
        console.error('Error analyzing video frame:', error);
        resolve(0);
      }
    };

    video.onerror = () => {
      console.error('Error loading video for rotation detection');
      resolve(0);
    };

    const url = URL.createObjectURL(file);
    video.src = url;
    video.load();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 5000);
  });
}

function isLikelyLandscapeContent(video: HTMLVideoElement): boolean {
  const width = video.videoWidth;
  const height = video.videoHeight;

  const commonMobilePortraitToLandscape = [
    { w: 720, h: 1280 },
    { w: 1080, h: 1920 },
    { w: 1080, h: 2280 },
    { w: 828, h: 1792 },
  ];

  return commonMobilePortraitToLandscape.some(
    res => Math.abs(width - res.w) < 50 && Math.abs(height - res.h) < 50
  );
}

function isLikelyPortraitContent(video: HTMLVideoElement): boolean {
  const width = video.videoWidth;
  const height = video.videoHeight;

  const aspectRatio = width / height;
  return aspectRatio > 2.5;
}

export async function extractVideoRotationFromMetadata(file: File): Promise<RotationAngle> {
  try {
    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer, 0, Math.min(8192, buffer.byteLength));

    const textDecoder = new TextDecoder();
    const headerString = textDecoder.decode(uint8Array);

    if (headerString.includes('rotate') || headerString.includes('rotation')) {
      const rotationMatch = headerString.match(/rotate[^0-9]*(\d+)/i);
      if (rotationMatch) {
        const rotation = parseInt(rotationMatch[1]);
        if ([0, 90, 180, 270].includes(rotation)) {
          return rotation as RotationAngle;
        }
      }
    }

    return extractVideoRotation(file);
  } catch (error) {
    console.error('Error extracting rotation from metadata:', error);
    return extractVideoRotation(file);
  }
}

export function getVideoRotationInfo(angle: RotationAngle): VideoRotationInfo {
  const needsCorrection = angle !== 0;

  let transform = '';
  let containerStyle: VideoRotationInfo['containerStyle'] = { transform: '' };

  switch (angle) {
    case 90:
      transform = 'rotate(270deg)';
      containerStyle = {
        transform: 'rotate(270deg)',
        width: 'max-content',
        height: 'max-content',
      };
      break;
    case 180:
      transform = 'rotate(180deg)';
      containerStyle = {
        transform: 'rotate(180deg)',
      };
      break;
    case 270:
      transform = 'rotate(90deg)';
      containerStyle = {
        transform: 'rotate(90deg)',
        width: 'max-content',
        height: 'max-content',
      };
      break;
    default:
      transform = 'none';
      containerStyle = { transform: 'none' };
  }

  return {
    angle,
    needsCorrection,
    transform,
    containerStyle,
  };
}

export function applyVideoRotationCorrection(
  videoElement: HTMLVideoElement,
  rotationInfo: VideoRotationInfo
): void {
  if (!rotationInfo.needsCorrection) {
    return;
  }

  videoElement.style.transform = rotationInfo.transform;

  if (rotationInfo.angle === 90 || rotationInfo.angle === 270) {
    const container = videoElement.parentElement;
    if (container) {
      container.style.display = 'flex';
      container.style.justifyContent = 'center';
      container.style.alignItems = 'center';
      container.style.overflow = 'hidden';
    }
  }
}

export async function detectAndCorrectVideoRotation(
  file: File,
  videoElement: HTMLVideoElement
): Promise<VideoRotationInfo> {
  try {
    const rotation = await extractVideoRotationFromMetadata(file);
    const rotationInfo = getVideoRotationInfo(rotation);

    applyVideoRotationCorrection(videoElement, rotationInfo);

    return rotationInfo;
  } catch (error) {
    console.error('Error in detectAndCorrectVideoRotation:', error);
    return {
      angle: 0,
      needsCorrection: false,
      transform: 'none',
      containerStyle: { transform: 'none' },
    };
  }
}


