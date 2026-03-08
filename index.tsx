/* tslint:disable */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI, LiveServerMessage, Modality, Session} from '@google/genai';
import {LitElement, css, html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {createBlob, decode, decodeAudioData} from './utils';
import './visual-3d';

@customElement('gdm-live-audio')
export class GdmLiveAudio extends LitElement {
  @state() isRecording = false;
  @state() isSessionReady = false;
  @state() status = '';
  @state() error = '';
  @state() currentShape = 'sphere';
  @state() apiKey = '';

  private client: GoogleGenAI;
  private session: Session;
  private readonly storageKey = 'gemini-api-key';
  private inputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({sampleRate: 16000});
  private outputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({sampleRate: 24000});
  @state() inputNode = this.inputAudioContext.createGain();
  @state() outputNode = this.outputAudioContext.createGain();
  private nextStartTime = 0;
  private mediaStream: MediaStream;
  private sourceNode: AudioBufferSourceNode;
  private scriptProcessorNode: ScriptProcessorNode;
  private sources = new Set<AudioBufferSourceNode>();

  static styles = css`
    #status {
      position: absolute;
      bottom: 5vh;
      left: 0;
      right: 0;
      z-index: 10;
      text-align: center;
      color: #00aaff;
      font-family: 'JetBrains Mono', monospace;
      text-transform: uppercase;
      letter-spacing: 2px;
      text-shadow: 0 0 10px rgba(0, 170, 255, 0.5);
      pointer-events: none;
    }

    .controls {
      z-index: 10;
      position: absolute;
      bottom: 10vh;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: row;
      gap: 20px;

      button {
        outline: none;
        border: 1px solid rgba(0, 170, 255, 0.3);
        color: #00aaff;
        border-radius: 50%;
        background: rgba(0, 170, 255, 0.05);
        width: 60px;
        height: 60px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        backdrop-filter: blur(5px);

        &:hover {
          background: rgba(0, 170, 255, 0.2);
          border-color: rgba(0, 170, 255, 0.6);
          box-shadow: 0 0 15px rgba(0, 170, 255, 0.4);
        }

        svg {
          fill: #00aaff;
        }
      }

      button[disabled] {
        opacity: 0.3;
        cursor: not-allowed;
      }
    }

    .setup-panel {
      position: absolute;
      top: 5vh;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10;
      width: min(520px, calc(100vw - 32px));
      padding: 16px;
      border: 1px solid rgba(0, 170, 255, 0.25);
      border-radius: 16px;
      background: rgba(2, 12, 24, 0.8);
      color: #d7f4ff;
      box-shadow: 0 0 24px rgba(0, 170, 255, 0.15);
      backdrop-filter: blur(10px);
    }

    .setup-panel h1 {
      margin: 0 0 8px;
      font-size: 1.1rem;
    }

    .setup-panel p {
      margin: 0 0 12px;
      line-height: 1.5;
      font-size: 0.92rem;
    }

    .setup-panel form {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .setup-panel input {
      flex: 1 1 260px;
      min-width: 0;
      border-radius: 10px;
      border: 1px solid rgba(0, 170, 255, 0.3);
      padding: 12px 14px;
      background: rgba(255, 255, 255, 0.04);
      color: inherit;
      font: inherit;
    }

    .setup-panel button {
      border-radius: 10px;
      border: 1px solid rgba(0, 170, 255, 0.3);
      padding: 12px 16px;
      background: rgba(0, 170, 255, 0.1);
      color: #00aaff;
      font: inherit;
      cursor: pointer;
    }

    .setup-panel small {
      display: block;
      margin-top: 10px;
      opacity: 0.8;
    }
  `;

  constructor() {
    super();
    this.apiKey =
      localStorage.getItem(this.storageKey) ?? process.env.GEMINI_API_KEY ?? '';
    if (this.apiKey) {
      this.initClient();
    } else {
      this.updateStatus('Enter a Gemini API key to start the live audio assistant.');
    }
  }

  private initAudio() {
    this.nextStartTime = this.outputAudioContext.currentTime;
  }

  private async initClient() {
    if (!this.apiKey) {
      this.updateError('A Gemini API key is required to start the assistant.');
      return;
    }

    this.initAudio();
    this.error = '';
    this.isSessionReady = false;

    this.client = new GoogleGenAI({
      apiKey: this.apiKey,
    });

    this.outputNode.connect(this.outputAudioContext.destination);

    await this.initSession();
  }

  private async initSession() {
    const model = 'gemini-2.5-flash-native-audio-preview-09-2025';

    try {
      this.session = await this.client.live.connect({
        model: model,
        callbacks: {
          onopen: () => {
            this.isSessionReady = true;
            this.updateStatus('Opened');
          },
          onmessage: async (message: LiveServerMessage) => {
            const audio =
              message.serverContent?.modelTurn?.parts[0]?.inlineData;

            if (audio) {
              this.nextStartTime = Math.max(
                this.nextStartTime,
                this.outputAudioContext.currentTime,
              );

              const audioBuffer = await decodeAudioData(
                decode(audio.data),
                this.outputAudioContext,
                24000,
                1,
              );
              const source = this.outputAudioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(this.outputNode);
              source.addEventListener('ended', () => {
                this.sources.delete(source);
              });

              source.start(this.nextStartTime);
              this.nextStartTime = this.nextStartTime + audioBuffer.duration;
              this.sources.add(source);
            }

            const transcription = message.serverContent?.modelTurn?.parts[0]?.text || 
                                message.serverContent?.modelTurn?.parts.find(p => p.text)?.text;
            
            const userTranscription = (message.serverContent as any)?.userTurn?.parts[0]?.text ||
                                    (message.serverContent as any)?.userTurn?.parts.find((p: any) => p.text)?.text;

            if (transcription || userTranscription) {
              const text = (transcription || '') + ' ' + (userTranscription || '');
              this.detectShape(text.toLowerCase());
            }

            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              for (const source of this.sources.values()) {
                source.stop();
                this.sources.delete(source);
              }
              this.nextStartTime = 0;
            }
          },
          onerror: (e: ErrorEvent) => {
            this.isSessionReady = false;
            this.updateError(e.message);
          },
          onclose: (e: CloseEvent) => {
            this.isSessionReady = false;
            this.updateStatus('Close:' + e.reason);
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Orus'}},
            // languageCode: 'en-GB'
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: "You are a high-tech AI core, similar to Cortana. You are represented as a holographic orb that can shapeshift. Your personality is professional, helpful, and slightly futuristic. Based on the topic of conversation, you should occasionally mention or imply a shape that you are taking. For example, if talking about space, you might be a sphere. If talking about buildings, a cube. If talking about donuts, a torus. If talking about mountains, a cone. If talking about DNA or complexity, a knot. If talking about pillars or tubes, a cylinder. I will be monitoring your output to change your 3D form. Try to weave these shapes into your responses naturally as if you are reconfiguring your data structure.",
        },
      });
    } catch (e) {
      console.error(e);
      this.isSessionReady = false;
      this.updateError(
        e instanceof Error
          ? e.message
          : 'Unable to initialize the Gemini live session.',
      );
    }
  }

  private updateStatus(msg: string) {
    this.status = msg;
  }

  private updateError(msg: string) {
    this.error = msg;
  }

  private detectShape(text: string) {
    if (text.includes('cube') || text.includes('box') || text.includes('square') || text.includes('building') || text.includes('city') || text.includes('structure')) {
      this.currentShape = 'box';
    } else if (text.includes('sphere') || text.includes('ball') || text.includes('planet') || text.includes('round') || text.includes('universe') || text.includes('atom')) {
      this.currentShape = 'sphere';
    } else if (text.includes('torus') || text.includes('donut') || text.includes('ring') || text.includes('circle') || text.includes('loop') || text.includes('orbit')) {
      this.currentShape = 'torus';
    } else if (text.includes('cone') || text.includes('pyramid') || text.includes('mountain') || text.includes('triangle') || text.includes('point') || text.includes('ice cream')) {
      this.currentShape = 'cone';
    } else if (text.includes('knot') || text.includes('complex') || text.includes('tangled') || text.includes('dna') || text.includes('molecule')) {
      this.currentShape = 'knot';
    } else if (text.includes('cylinder') || text.includes('tube') || text.includes('pipe') || text.includes('pillar') || text.includes('column')) {
      this.currentShape = 'cylinder';
    }
  }

  private async saveApiKey(event: Event) {
    event.preventDefault();
    const value = this.apiKey.trim();

    if (!value) {
      this.updateError('Please enter a Gemini API key.');
      return;
    }

    localStorage.setItem(this.storageKey, value);
    this.apiKey = value;
    this.updateStatus('API key saved. Connecting to Gemini...');
    await this.initClient();
  }

  private async startRecording() {
    if (this.isRecording) {
      return;
    }

    this.inputAudioContext.resume();

    this.updateStatus('Requesting microphone access...');

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      this.updateStatus('Microphone access granted. Starting capture...');

      this.sourceNode = this.inputAudioContext.createMediaStreamSource(
        this.mediaStream,
      );
      this.sourceNode.connect(this.inputNode);

      const bufferSize = 256;
      this.scriptProcessorNode = this.inputAudioContext.createScriptProcessor(
        bufferSize,
        1,
        1,
      );

      this.scriptProcessorNode.onaudioprocess = (audioProcessingEvent) => {
        if (!this.isRecording) return;

        const inputBuffer = audioProcessingEvent.inputBuffer;
        const pcmData = inputBuffer.getChannelData(0);

        this.session.sendRealtimeInput({media: createBlob(pcmData)});
      };

      this.sourceNode.connect(this.scriptProcessorNode);
      this.scriptProcessorNode.connect(this.inputAudioContext.destination);

      this.isRecording = true;
      this.updateStatus('🔴 Recording... Capturing PCM chunks.');
    } catch (err) {
      console.error('Error starting recording:', err);
      this.updateStatus(`Error: ${err.message}`);
      this.stopRecording();
    }
  }

  private stopRecording() {
    if (!this.isRecording && !this.mediaStream && !this.inputAudioContext)
      return;

    this.updateStatus('Stopping recording...');

    this.isRecording = false;

    if (this.scriptProcessorNode && this.sourceNode && this.inputAudioContext) {
      this.scriptProcessorNode.disconnect();
      this.sourceNode.disconnect();
    }

    this.scriptProcessorNode = null;
    this.sourceNode = null;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.updateStatus('Recording stopped. Click Start to begin again.');
  }

  private reset() {
    this.session?.close();
    this.initSession();
    this.updateStatus('Session cleared.');
  }

  render() {
    return html`
      <div>
        <div class="controls">
          <button
            id="resetButton"
            @click=${this.reset}
            ?disabled=${this.isRecording || !this.apiKey || !this.isSessionReady}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="32px"
              viewBox="0 -960 960 960"
              width="32px">
              <path
                d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z" />
            </svg>
          </button>
          <button
            id="startButton"
            @click=${this.startRecording}
            ?disabled=${this.isRecording || !this.apiKey || !this.isSessionReady}>
            <svg
              viewBox="0 0 100 100"
              width="24px"
              height="24px"
              xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="40" stroke="#00aaff" stroke-width="8" fill="none" />
              <circle cx="50" cy="50" r="20" fill="#00aaff" />
            </svg>
          </button>
          <button
            id="stopButton"
            @click=${this.stopRecording}
            ?disabled=${!this.isRecording}>
            <svg
              viewBox="0 0 100 100"
              width="24px"
              height="24px"
              xmlns="http://www.w3.org/2000/svg">
              <rect x="20" y="20" width="60" height="60" rx="8" fill="#00aaff" />
            </svg>
          </button>
        </div>

        ${this.apiKey
          ? null
          : html`<div class="setup-panel">
              <h1>Connect your Gemini API key</h1>
              <p>
                This GitHub Pages frontend runs entirely in your browser. Enter
                your Gemini API key once and it will be stored locally in this
                browser so the live audio assistant can connect.
              </p>
              <form @submit=${this.saveApiKey}>
                <input
                  type="password"
                  .value=${this.apiKey}
                  @input=${(event: Event) => {
                    this.apiKey = (event.target as HTMLInputElement).value;
                  }}
                  placeholder="Paste Gemini API key" />
                <button type="submit">Save key</button>
              </form>
              <small>
                Tip: for local development you can still use
                <code>GEMINI_API_KEY</code> in <code>.env.local</code>.
              </small>
            </div>`}

        <div id="status"> 
          ${this.error || this.status}
          <div style="font-size: 10px; opacity: 0.7; margin-top: 8px; letter-spacing: 4px;">
            FORM_ID: ${this.currentShape.toUpperCase()}
          </div>
        </div>
        <gdm-live-audio-visuals-3d
          .inputNode=${this.inputNode}
          .outputNode=${this.outputNode}
          .shape=${this.currentShape}
          .isRecording=${this.isRecording}></gdm-live-audio-visuals-3d>
      </div>
    `;
  }
}
