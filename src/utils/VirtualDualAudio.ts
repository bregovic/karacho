export class VirtualDualAudio {
  context: AudioContext;
  origBuf: AudioBuffer | null = null;
  instBuf: AudioBuffer | null = null;
  
  origSrc: AudioBufferSourceNode | null = null;
  instSrc: AudioBufferSourceNode | null = null;
  origGain: GainNode;
  instGain: GainNode;

  _isPlaying: boolean = false;
  _currentTime: number = 0;
  _startedAtContextTime: number = 0;
  _playbackRate: number = 1.0;
  _duration: number = 0;
  _muted: boolean = false;
  
  onplay: () => void = () => {};
  onpause: () => void = () => {};
  onended: () => void = () => {};
  onplaying: () => void = () => {};
  onloadprogress: (p: number) => void = () => {};

  activeTrack: 'INST' | 'ORIG' = 'ORIG';

  constructor() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.context = new AudioContextClass();
    this.origGain = this.context.createGain();
    this.instGain = this.context.createGain();
    this.origGain.connect(this.context.destination);
    this.instGain.connect(this.context.destination);
  }

  async load(origUrl: string, instUrl: string) {
    this.onloadprogress(10);
    
    const fetchAndDecode = async (url: string): Promise<AudioBuffer> => {
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      return new Promise((resolve, reject) => {
         this.context.decodeAudioData(arrayBuffer, 
           (buffer) => resolve(buffer), 
           (err) => reject(err)
         );
      });
    };

    try {
      const [orig, inst] = await Promise.all([
        fetchAndDecode(origUrl),
        instUrl ? fetchAndDecode(instUrl) : Promise.resolve(null)
      ]);
      this.origBuf = orig;
      this.instBuf = inst;
      this._duration = orig.duration;
      this.onloadprogress(100);
    } catch (err) {
      console.error("VirtualDualAudio load error:", err);
      this.onloadprogress(-1); // error state
    }
  }

  get paused() { return !this._isPlaying; }
  get duration() { return this._duration; }
  
  get currentTime() {
     if (this._isPlaying) {
        return this._currentTime + (this.context.currentTime - this._startedAtContextTime) * this._playbackRate;
     }
     return this._currentTime;
  }
  
  set currentTime(v: number) {
     const wasPlaying = this._isPlaying;
     if (wasPlaying) this.pause();
     this._currentTime = Math.max(0, Math.min(v, this._duration));
     if (wasPlaying) this.play();
  }
  
  get playbackRate() { return this._playbackRate; }
  
  set playbackRate(v: number) {
     this._playbackRate = v;
     if (this.origSrc) this.origSrc.playbackRate.value = v;
     if (this.instSrc) this.instSrc.playbackRate.value = v;
  }

  get muted() { return this._muted; }
  
  set muted(v: boolean) {
     this._muted = v;
     this._updateGains();
  }

  setTrack(track: 'INST' | 'ORIG') {
     this.activeTrack = track;
     this._updateGains();
  }

  _updateGains() {
     const t = this.context.currentTime;
     if (this._muted) {
       this.origGain.gain.setTargetAtTime(0, t, 0.05);
       this.instGain.gain.setTargetAtTime(0, t, 0.05);
       return;
     }
     if (this.activeTrack === 'INST') {
       this.origGain.gain.setTargetAtTime(0, t, 0.05);
       this.instGain.gain.setTargetAtTime(1, t, 0.05);
     } else if (this.activeTrack === 'ORIG') {
       this.origGain.gain.setTargetAtTime(1, t, 0.05);
       this.instGain.gain.setTargetAtTime(0, t, 0.05);
     }
  }

  async play() {
     if (this._isPlaying) return;
     if (this.context.state === 'suspended') await this.context.resume();
     
     this._updateGains();
     
     this.origSrc = this.context.createBufferSource();
     if (this.origBuf) this.origSrc.buffer = this.origBuf;
     this.origSrc.connect(this.origGain);
     this.origSrc.playbackRate.value = this._playbackRate;
     this.origSrc.start(0, this._currentTime);

     if (this.instBuf) {
       this.instSrc = this.context.createBufferSource();
       this.instSrc.buffer = this.instBuf;
       this.instSrc.connect(this.instGain);
       this.instSrc.playbackRate.value = this._playbackRate;
       this.instSrc.start(0, this._currentTime);
     }
     
     this._startedAtContextTime = this.context.currentTime;
     this._isPlaying = true;
     
     this.origSrc.onended = () => {
        // If it ended naturally (not stopped by pause)
        if (this._isPlaying && this.currentTime >= this.duration - 0.5) {
           this._isPlaying = false;
           this.onended();
        }
     };

     this.onplay();
     setTimeout(() => this.onplaying(), 50);
  }

  pause() {
     if (!this._isPlaying) return;
     this._currentTime = this.currentTime; // store precise current time
     this._isPlaying = false;
     
     if (this.origSrc) {
       try { this.origSrc.stop(); } catch(e){} 
       this.origSrc.disconnect(); 
       this.origSrc = null; 
     }
     if (this.instSrc) { 
       try { this.instSrc.stop(); } catch(e){} 
       this.instSrc.disconnect(); 
       this.instSrc = null; 
     }
     
     this.onpause();
  }

  destroy() {
    this.pause();
    this.context.close();
  }
}
