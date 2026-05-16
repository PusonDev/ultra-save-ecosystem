const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binDir = path.join(__dirname, '../resources/bin');
const zipPath = path.join(binDir, 'ffmpeg.zip');
// Using a more direct gyan.dev link for binary
const ffmpegUrl = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

console.log('--- STARTING FFMPEG DOWNLOAD ---');

const file = fs.createWriteStream(zipPath);
https.get(ffmpegUrl, function(response) {
  if (response.statusCode === 302 || response.statusCode === 301) {
    // Handle redirect manually if needed
    https.get(response.headers.location, (res) => res.pipe(file));
  } else {
    response.pipe(file);
  }

  file.on('finish', function() {
    file.close(() => {
      console.log('Download complete. Extracting via PowerShell...');
      try {
        const extractCmd = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${binDir}' -Force"`;
        execSync(extractCmd);
        
        // Find the ffmpeg.exe in subdirs
        const folders = fs.readdirSync(binDir);
        const ffmpegFolder = folders.find(f => f.startsWith('ffmpeg'));
        if (ffmpegFolder) {
            const srcExe = path.join(binDir, ffmpegFolder, 'bin', 'ffmpeg.exe');
            const destExe = path.join(binDir, 'ffmpeg.exe');
            if (fs.existsSync(srcExe)) {
                fs.copyFileSync(srcExe, destExe);
                console.log('✅ FFMPEG SUCCESS!');
            }
            // Cleanup
            fs.rmSync(path.join(binDir, ffmpegFolder), { recursive: true, force: true });
        }
        fs.unlinkSync(zipPath);
      } catch (e) {
        console.error('❌ Extraction failed. Please unzip ffmpeg.zip manually in resources/bin');
        console.error(e.message);
      }
    });
  });
}).on('error', (err) => console.error(err.message));
