class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.currentMusic = null;
    this.currentPhase = null;
    this.initialized = false;
    
    
    this.assets = {
      musicLobby: '/audio/lobby.mp3',
      musicGlassBridge: '/audio/Way Back then  Squid Game OST.mp3',
      musicFinalGame: '/audio/rlgl.mp3',
      musicTugOfWar: '/audio/The Rope is Tied.mp3'
    };
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.ctx.destination);

      
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0; 
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 1.0; 
      this.sfxGain.connect(this.masterGain);

      this.initialized = true;
      console.log('🔊 SoundManager 6.0 (V6 - Professional) enabled');
      
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      
      if (['lobby', 'explanation', 'countdown'].includes(this.currentPhase) || !this.currentPhase) {
          this.playMusic(this.assets.musicLobby);
      }
    } catch (e) {
      console.warn('Audio context creation failed:', e);
    }
  }

  
  playMusic(url, loop = true, fadeSeconds = 1) {
    if (!this.initialized) return;
    if (!this.ctx) return;
    
    
    if (this.currentMusic && this.currentMusic.src.includes(url)) {
        this.fadeIn(fadeSeconds);
        return;
    }

    this.stopMusic(0);

    const audio = new Audio(url);
    audio.loop = loop;
    audio.crossOrigin = "anonymous";
    
    const source = this.ctx.createMediaElementSource(audio);
    source.connect(this.musicGain);
    
    audio.play().then(() => {
        this.fadeIn(fadeSeconds);
    }).catch(e => console.warn("Music blocked:", e));
    
    this.currentMusic = audio;
  }

  fadeIn(duration = 1) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(0.5, now + duration);
  }

  stopMusic(duration = 1) {
    if (this.glassBridgeInterval) {
        clearInterval(this.glassBridgeInterval);
        this.glassBridgeInterval = null;
    }
    if (this.rlglInterval) {
        clearInterval(this.rlglInterval);
        this.rlglInterval = null;
    }

    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(0, now + duration);
    
    
    const audioToStop = this.currentMusic;
    this.currentMusic = null; 

    if (duration > 0 && audioToStop) {
        setTimeout(() => {
            audioToStop.pause();
            audioToStop.src = "";
        }, duration * 1000 + 100);
    } else if (audioToStop) {
        audioToStop.pause();
        audioToStop.src = "";
    }
  }

  playGlassBridgeMusic() {
    if (!this.initialized) return;
    if (!this.ctx) return;
    
    this.stopMusic(1); 
    
    const audio = new Audio(this.assets.musicGlassBridge);
    audio.crossOrigin = "anonymous";
    audio.loop = true;
    
    const source = this.ctx.createMediaElementSource(audio);
    source.connect(this.musicGain);

    audio.currentTime = 5; 
    
    audio.play().then(() => {
        const now = this.ctx.currentTime;
        this.musicGain.gain.cancelScheduledValues(now);
        this.musicGain.gain.setValueAtTime(0, now);
        this.musicGain.gain.linearRampToValueAtTime(0.15, now + 2);
    }).catch(e => console.warn("Way Back Then blocked:", e));

    this.currentMusic = audio;
  }

  playFinalGameMusic() {
    if (!this.initialized) return;
    if (!this.ctx) return;
    
    this.stopMusic(1); 
    
    const audio = new Audio(this.assets.musicFinalGame);
    audio.crossOrigin = "anonymous";
    
    
    const source = this.ctx.createMediaElementSource(audio);
    source.connect(this.musicGain);

    audio.currentTime = 0; 
    
    audio.play().then(() => {
        const now = this.ctx.currentTime;
        this.musicGain.gain.cancelScheduledValues(now);
        this.musicGain.gain.setValueAtTime(0, now);
        this.musicGain.gain.linearRampToValueAtTime(0.15, now + 2); // -> 0.15
    }).catch(e => console.warn("RLGL Music blocked:", e));

    this.currentMusic = audio;

    if (this.rlglInterval) clearInterval(this.rlglInterval);

    
    this.rlglInterval = setInterval(() => {
        if (!this.currentMusic || this.currentMusic !== audio) {
            clearInterval(this.rlglInterval);
            this.rlglInterval = null;
            return;
        }
        if (audio.currentTime >= 64) {
            audio.currentTime = 0; 
        }
    }, 100);
  }

  playTugOfWarMusic() {
    if (!this.initialized) return;
    if (!this.ctx) return;
    
    this.stopMusic(1); 
    
    const audio = new Audio(this.assets.musicTugOfWar);
    audio.crossOrigin = "anonymous";
    audio.loop = true;
    
    const source = this.ctx.createMediaElementSource(audio);
    source.connect(this.musicGain);

    audio.currentTime = 15; 
    
    audio.play().then(() => {
        const now = this.ctx.currentTime;
        this.musicGain.gain.cancelScheduledValues(now);
        this.musicGain.gain.setValueAtTime(0, now);
        this.musicGain.gain.linearRampToValueAtTime(0.15, now + 2); // -> 0.15
    }).catch(e => console.warn("Tug Of War Music blocked:", e));

    this.currentMusic = audio;
  }


  playSfxVictory() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
        this.playNote(freq, 'sine', now + i * 0.15, 0.4, 0.2);
        this.playNote(freq * 1.01, 'sawtooth', now + i * 0.15, 0.1, 0.05);
    });
  }

  playNote(freq, type, startTime, duration, volume = 0.3) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  playSfxElimination() {
    if (!this.ctx) return;
    this.playNote(50, 'sine', this.ctx.currentTime, 0.8, 0.4); 
  }

  playSfxShotgun() {
    if (!this.initialized) return;
    const audio = new Audio('/audio/pump-shotgun-fortnite-loud.mp3');
    
    audio.addEventListener('loadedmetadata', () => {
        if (this.ctx) {
           const source = this.ctx.createMediaElementSource(audio);
           const gainNode = this.ctx.createGain();
           
           const now = this.ctx.currentTime;
           gainNode.gain.setValueAtTime(1, now);
           // Démarre le fondu de sortie (fade out) à 1.5 secondes
           gainNode.gain.setValueAtTime(1, now + 1.5);
           // Termine le fondu à 2.0 secondes
           gainNode.gain.linearRampToValueAtTime(0.001, now + 2.0);
           
           source.connect(gainNode);
           gainNode.connect(this.sfxGain);
        }
        
        audio.play().catch(e => console.warn(e));
        
        // Stopper le son complètement après ~2.1 secondes pour éviter le reste du clip
        setTimeout(() => {
            audio.pause();
            audio.src = "";
        }, 2100);
    });
  }

  playTick(volume = 0.15) {
    if (!this.ctx) return;
    this.playNote(1200, 'sine', this.ctx.currentTime, 0.05, volume); 
  }

  playSfxGreenLight() {
    if (!this.ctx) return;
    this.playNote(800, 'sine', this.ctx.currentTime, 0.3, 0.2);
    this.playNote(1000, 'sine', this.ctx.currentTime + 0.1, 0.4, 0.2);
  }

  playSfxRedLight() {
    if (!this.ctx) return;
    this.playNote(400, 'sawtooth', this.ctx.currentTime, 0.5, 0.3);
  }

  playSfxWarning() {
    if (!this.ctx) return;
    this.playNote(600, 'sine', this.ctx.currentTime, 0.2, 0.1);
    this.playNote(600, 'sine', this.ctx.currentTime + 0.3, 0.2, 0.1);
  }

  playDollSong(targetSeconds) {
    if (!this.initialized) return;
    targetSeconds = Math.max(0.5, targetSeconds);

    if (this.dollAudio) {
        this.dollAudio.pause();
    }
    
    const audio = new Audio('/audio/elim.mp3');
    
    audio.addEventListener('loadedmetadata', () => {
        const originalDuration = audio.duration || 4.5;
        const rate = originalDuration / targetSeconds;
        
        audio.preservesPitch = false; 
        audio.playbackRate = Math.max(0.2, Math.min(rate, 5.0)); 
        
        if (this.ctx) {
           const source = this.ctx.createMediaElementSource(audio);
           source.connect(this.sfxGain);
        }
        
        audio.play().catch(e => console.warn(e));
    });
    this.dollAudio = audio;
  }

  stopDollSong() {
      if (this.dollAudio) {
          this.dollAudio.pause();
          this.dollAudio = null;
      }
  }


  onPhaseChange(newPhase, currentGameObj = null) {
    if (newPhase === this.currentPhase) return;
    this.currentPhase = newPhase;

    console.log(`🎵 System Phase: ${newPhase}`);

    switch (newPhase) {
      case 'lobby':
      case 'betting':
      case 'explanation':
      case 'transition_bank':
      case 'transition_roulette':
        this.playMusic(this.assets.musicLobby, true, 2); 
        break;
      case 'countdown':
        if (currentGameObj && currentGameObj.name === 'Le Pont de Verre') {
            this.playGlassBridgeMusic();
        } else if (currentGameObj && currentGameObj.name === 'Jeu Final') {
            this.playFinalGameMusic();
        } else if (currentGameObj && currentGameObj.name === 'Le Jeu de la Corde') {
            this.playTugOfWarMusic();
        } else {
            this.stopMusic(2); 
        }
        break;
      case 'playing':
        if (currentGameObj && (
            currentGameObj.name === 'Le Pont de Verre' || 
            currentGameObj.name === 'Jeu Final' || 
            currentGameObj.name === 'Le Jeu de la Corde'
        )) {
            
        } else {
            this.stopMusic(0.5);
        }
        break;
      case 'gameover':
        this.stopMusic(0.1);
        this.playSfxVictory();
        
        setTimeout(() => {
            if (this.currentPhase === 'gameover') this.playMusic(this.assets.musicLobby, true, 3);
        }, 1200);
        break;
    }
  }
}

window.soundManager = new SoundManager();
