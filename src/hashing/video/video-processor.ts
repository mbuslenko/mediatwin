import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { PassThrough } from 'stream';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export interface VideoMetadata {
  /** Duration in seconds */
  duration: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Frames per second */
  fps: number;
  /** Video codec */
  codec: string;
}

export class VideoProcessor {
  async getMetadata(videoPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to get video metadata: ${err.message}`));
          return;
        }

        const videoStream = metadata.streams.find((s) => s.codec_type === 'video');

        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        const duration = metadata.format.duration || 0;
        const fps = this.parseFps(videoStream.r_frame_rate || '30/1');

        resolve({
          duration,
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          fps,
          codec: videoStream.codec_name || 'unknown',
        });
      });
    });
  }

  async extractFrame(videoPath: string, timestamp: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const passThrough = new PassThrough();

      passThrough.on('data', (chunk: Buffer) => chunks.push(chunk));
      passThrough.on('end', () => resolve(Buffer.concat(chunks)));
      passThrough.on('error', reject);

      ffmpeg(videoPath)
        .seekInput(timestamp)
        .frames(1)
        .format('image2pipe')
        .outputOptions(['-vcodec', 'png', '-f', 'image2pipe'])
        .on('error', (err) => {
          reject(new Error(`Failed to extract frame: ${err.message}`));
        })
        .pipe(passThrough, { end: true });
    });
  }

  async extractFrames(
    videoPath: string,
    timestamps: number[]
  ): Promise<Map<number, Buffer>> {
    const frames = new Map<number, Buffer>();

    // extract frames sequentially to avoid ffmpeg conflicts
    for (const timestamp of timestamps) {
      try {
        const frame = await this.extractFrame(videoPath, timestamp);
        frames.set(timestamp, frame);
      } catch (err) {
        console.warn(`Failed to extract frame at ${timestamp}s: ${err}`);
      }
    }

    return frames;
  }

  /**
   * calculate frame timestamps based on interval and max frames
   */
  calculateTimestamps(
    duration: number,
    interval: number,
    maxFrames: number
  ): number[] {
    const timestamps: number[] = [];

    for (let t = 0; t < duration && timestamps.length < maxFrames; t += interval) {
      timestamps.push(t);
    }

    return timestamps;
  }

  /**
   * Parse FPS from string like "30/1" or "29.97"
   */
  private parseFps(fpsStr: string): number {
    if (fpsStr.includes('/')) {
      const [num, den] = fpsStr.split('/').map(Number);
      return den > 0 ? num / den : 30;
    }
    return parseFloat(fpsStr) || 30;
  }
}

export const videoProcessor = new VideoProcessor();
