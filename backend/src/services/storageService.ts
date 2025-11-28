import { S3Client, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import logger from '../utils/logger';

/**
 * StorageService - High-Performance S3/R2 File Management
 * 
 * Features:
 * - Multipart Uploads (Stream-based) for large files (GeoTIFFs > 100MB)
 * - Presigned URLs for secure, temporary access
 * - Compatible with AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces
 * - Automatic concurrency management
 */
export class StorageService {
    private client: S3Client;
    private bucket: string;

    constructor() {
        const { endpoint, region, accessKeyId, secretAccessKey, bucketName } = config.storage;

        if (!accessKeyId || !secretAccessKey) {
            logger.warn('Storage credentials missing. StorageService will fail if used.');
        }

        this.bucket = bucketName;

        this.client = new S3Client({
            endpoint,
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
            // Force path style for compatibility with some S3 providers (MinIO, etc.)
            forcePathStyle: false,
        });

        logger.info({ bucket: this.bucket, region }, 'StorageService initialized');
    }

    /**
     * Upload a large file using Multipart Upload (Stream)
     * Optimized for low memory usage and high reliability
     */
    async uploadFile(filePath: string, key: string, contentType: string = 'application/octet-stream'): Promise<string> {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const fileStream = fs.createReadStream(filePath);
            const fileSize = fs.statSync(filePath).size;

            logger.info({ key, sizeMB: (fileSize / 1024 / 1024).toFixed(2) }, 'Starting upload to storage');

            const upload = new Upload({
                client: this.client,
                params: {
                    Bucket: this.bucket,
                    Key: key,
                    Body: fileStream,
                    ContentType: contentType,
                },
                // Performance tuning
                queueSize: 4, // Number of concurrent parts
                partSize: 1024 * 1024 * 10, // 10MB chunks (better for large files)
                leavePartsOnError: false,
            });

            upload.on('httpUploadProgress', (progress) => {
                if (progress.loaded && progress.total) {
                    const percent = Math.round((progress.loaded / progress.total) * 100);
                    // Log every 20% to avoid spam
                    if (percent % 20 === 0) {
                        logger.debug({ key, percent }, 'Upload progress');
                    }
                }
            });

            await upload.done();

            logger.info({ key }, 'Upload completed successfully');
            return key;

        } catch (error: any) {
            logger.error({ error: error.message, key }, 'Failed to upload file');
            throw error;
        }
    }

    /**
     * Generate a temporary signed URL for downloading a file
     * @param expiresInSeconds Duration in seconds (default 1 hour)
     */
    async getSignedDownloadUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
            });

            const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
            return url;

        } catch (error: any) {
            logger.error({ error: error.message, key }, 'Failed to generate signed URL');
            throw error;
        }
    }

    /**
     * Delete a file from storage
     */
    async deleteFile(key: string): Promise<void> {
        try {
            const command = new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: key,
            });

            await this.client.send(command);
            logger.info({ key }, 'File deleted from storage');

        } catch (error: any) {
            logger.error({ error: error.message, key }, 'Failed to delete file');
            throw error;
        }
    }

    /**
     * Check if bucket exists and is accessible
     */
    async checkHealth(): Promise<boolean> {
        try {
            const command = new HeadBucketCommand({
                Bucket: this.bucket,
            });
            await this.client.send(command);
            return true;
        } catch (error) {
            logger.error({ error }, 'Storage health check failed');
            return false;
        }
    }
}

export const storageService = new StorageService();
