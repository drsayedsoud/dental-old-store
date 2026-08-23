const { TwaGenerator, TwaManifest } = require('@bubblewrap/core');
const fs = require('fs');
const path = require('path');

async function buildApp() {
  try {
    const twaManifest = await TwaManifest.fromFile(path.join(process.cwd(), 'twa-manifest.json'));
    const generator = new TwaGenerator();
    console.log('Generating project...');
    await generator.createTwaProject(process.cwd(), twaManifest);
    console.log('Project generated!');
    
    // Change targetSdkVersion to 35
    const gradlePath = path.join(process.cwd(), 'app', 'build.gradle');
    let gradle = fs.readFileSync(gradlePath, 'utf8');
    gradle = gradle.replace(/targetSdkVersion \d+/, 'targetSdkVersion 35');
    fs.writeFileSync(gradlePath, gradle);
    console.log('Target SDK updated to 35');

    console.log('Building project with Gradle...');
    const { execSync } = require('child_process');
    // Ensure JAVA_HOME is set
    process.env.JAVA_HOME = "C:\\Users\\dell\\Desktop\\jdk\\jdk-21.0.3+9";
    // Setup SDK
    fs.writeFileSync('local.properties', 'sdk.dir=C:\\\\Users\\\\dell\\\\AppData\\\\Local\\\\Android\\\\Sdk');
    
    // Modify gradle.properties for signing
    let props = fs.readFileSync('gradle.properties', 'utf8');
    props = props.replace('android.buildKeyPassword=', 'android.buildKeyPassword=awladsakr');
    props = props.replace('android.buildStorePassword=', 'android.buildStorePassword=awladsakr');
    fs.writeFileSync('gradle.properties', props);

    execSync('gradlew.bat assembleRelease bundleRelease', { stdio: 'inherit' });
    console.log('Build complete!');
  } catch (e) {
    console.error(e);
  }
}
buildApp();
