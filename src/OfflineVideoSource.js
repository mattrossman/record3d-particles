import * as THREE from 'three'

/**
 * Adapted from Marek Simonk's sample code:
 * https://github.com/marek-simonik/record3d-wifi-streaming-and-rgbd-mp4-3d-video-demo/blob/aad14b61779fb19589c34a5bd0e887416bd51970/js/app/video-sources/OfflineVideoSource.js
 */

export class OfflineVideoSource {
  constructor() {
    this.intrMat = new THREE.Matrix3()
    this.videoTag = document.createElement('video')
    this.videoTag.autoplay = true
    this.videoTag.muted = true
    this.videoTag.loop = true
    this.videoTag.playsinline = true
    this.videoTag.setAttribute('playsinline', '')
    this.isVideoLoaded = false
    this.maxNumPoints = 720 * 960

    // Autoplay on mobile / HMD needs the video to be in viewport
    document.body.appendChild(this.videoTag)
    Object.assign(this.videoTag.style, {
      position: 'absolute',
      zIndex: -1,
      height: '0px',
      width: '0px',
    })

    this.lastVideoSize = { width: 0, height: 0 }
    this.onVideoChange = () => {}

    let self = this

    this.videoTag.onloadeddata = (e) => {
      self.isVideoLoaded = true
      self.lastVideoSize.width = self.videoTag.videoWidth
      self.lastVideoSize.height = self.videoTag.videoHeight
      self.onVideoChange()
    }
  }

  /**
   * @param {Blob} videoFile
   */
  async load(videoFile) {
    let self = this

    /** @type {Promise<HTMLVideoElement>} */
    const videoPromise = new Promise((resolve) => {
      let dataURLReader = new FileReader()
      dataURLReader.onload = (e) => {
        self.videoTag.src = e.target.result
        self.maxNumPoints = (self.videoTag.videoWidth * self.videoTag.videoHeight) / 4
        resolve(self.videoTag)
      }
      dataURLReader.readAsDataURL(videoFile)
    })

    /** @type {Promise<[number, number]>} */
    const resolutionPromise = new Promise((resolve) => {
      self.videoTag.onloadeddata = (e) => {
        resolve([self.videoTag.videoWidth, self.videoTag.videoHeight])
      }
    })

    /** @type {Promise<THREE.Matrix3>} */
    const matrixPromise = new Promise((resolve) => {
      let binaryMetadataReader = new FileReader()
      binaryMetadataReader.onload = (e) => {
        let fileContents = e.target.result
        let meta = fileContents.substr(fileContents.lastIndexOf('{"intrinsic'))
        meta = meta.substr(0, meta.length - 1)
        let metadata = JSON.parse(meta)
        self.intrMat.elements = metadata['intrinsicMatrix']
        self.intrMat.transpose()
        resolve(self.intrMat)
      }
      binaryMetadataReader.readAsBinaryString(videoFile)
    })

    return {
      video: await videoPromise,
      videoResolution: await resolutionPromise,
      intrMat: await matrixPromise,
    }
  }

  updateIntrinsicMatrix(intrMat) {
    this.intrMat = intrMat
  }

  toggle() {
    if (this.videoTag.paused) this.videoTag.play()
    else this.videoTag.pause()
  }

  toggleAudio() {
    this.videoTag.muted = !this.videoTag.muted
  }

  getVideoSize() {
    return { width: this.lastVideoSize.width / 2, height: this.lastVideoSize.height }
  }
}
