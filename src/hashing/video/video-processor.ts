import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';

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
    const fs = await import('fs/promises');
    const tempPath = join(tmpdir(), `mediatwin-frame-${randomUUID()}.png`);

    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .seekInput(timestamp)
          .frames(1)
          .output(tempPath)
          .outputOptions(['-vcodec', 'png'])
          .on('end', () => resolve())
          .on('error', (err) => {
            reject(new Error(`FFmpeg error: ${err.message}`));
          })
          .run();
      });

      try {
        await fs.access(tempPath);
      } catch {
        throw new Error(`Frame not created at timestamp ${timestamp}s`);
      }

      const buffer = await fs.readFile(tempPath);

      if (buffer.length === 0) {
        throw new Error(`Empty frame at timestamp ${timestamp}s`);
      }

      await fs.unlink(tempPath).catch(() => {});
      return buffer;
    } catch (err) {
      await fs.unlink(tempPath).catch(() => {});
      throw err;
    }
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
      } catch {
        // Frame extraction can fail for timestamps beyond video duration
        // This is expected and not logged to avoid noise
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
