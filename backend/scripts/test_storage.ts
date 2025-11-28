
import { storageService } from '../src/services/storageService';
import fs from 'fs';
import path from 'path';

async function testStorage() {
    console.log('🚀 TESTING STORAGE SERVICE');
    console.log('==========================');

    const testFile = path.join(__dirname, 'test-upload.txt');
    const testKey = `tests/test-${Date.now()}.txt`;

    try {
        // 1. Create dummy file
        console.log('1. Creating dummy file...');
        fs.writeFileSync(testFile, 'This is a test file for Sentryal Storage Service.\nTimestamp: ' + new Date().toISOString());
        console.log('✅ File created:', testFile);

        // 2. Upload
        console.log('\n2. Uploading to Storage...');
        // Note: This will fail if credentials are not set in .env, which is expected in dev without keys
        if (!process.env.STORAGE_ACCESS_KEY_ID) {
            console.log('⚠️ SKIPPING UPLOAD: No credentials in .env');
            console.log('   Add STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY, STORAGE_BUCKET_NAME to .env to test real upload.');
            return;
        }

        await storageService.uploadFile(testFile, testKey, 'text/plain');
        console.log('✅ Upload successful! Key:', testKey);

        // 3. Get Signed URL
        console.log('\n3. Generating Signed URL...');
        const url = await storageService.getSignedDownloadUrl(testKey, 300); // 5 mins
        console.log('✅ URL Generated:');
        console.log(url);

        // 4. Cleanup
        console.log('\n4. Cleaning up...');
        await storageService.deleteFile(testKey);
        console.log('✅ Remote file deleted');

        fs.unlinkSync(testFile);
        console.log('✅ Local file deleted');

    } catch (error: any) {
        console.error('\n❌ TEST FAILED:', error.message);
    }
}

testStorage();
