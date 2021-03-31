"use strict"
/*

  Implementation of the Vue app that bridges between cordova webcam stream, `diff-cam-engine.js` and the cloud storage enginges in `enginge.js`

*/
const getSeconds = () => new Date().getTime() / 1000;

const timeout  = (ms) =>  new Promise(resolve => setTimeout(resolve, ms)); 

const getByKeys  = (dict, keys) => {let result = []; for(k in keys){ result.push(dict[k]) }; result;}

/*
  Singleton to let the user download content within a `Blob`.
  taken from https://stackoverflow.com/questions/23451726/saving-binary-data-as-file-using-javascript-from-a-browser
*/
const saveByteArray = (function () {
    let a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    return function (data, name, format, _url) {
	
	let url = _url || window.URL.createObjectURL(data);
	a.href = url;
	a.download = name;
	a.click();
	window.URL.revokeObjectURL(url);
    };
}());


var app;

document.addEventListener("deviceready", onDeviceReady, false);

function onDeviceReady() {
    let  recorder = null;
    let recorded_frames = null;
    
    app = new Vue({
	el: '#app',
	data: {
	    camera_name:'Untitled Camera',
	    start_enabled:true,
	    score: 0,
	    score_threshold: 20, //difference that trigger recordings, in terms of `diff-cam-engine.js`
	    last_excess: null, //time of last excess that triggered a recording
	    delta_t_record:2,  //how much time keep recording after motion detection finiched
	    record: false,
	    now: null,
	    saving:false,
	    drop_down:false,
	    section:'splash',
	    first_start:true,
	    output_counter:1,
	    cloud_key: null,
	    cloud_configs:{},
	    cloud_config_forms:{},
	    cloud_description_cache:null,
	    cloud_keys: Object.keys(CloudPlatforms),	
	    file_list_cache:[],
	    preview_filename:'',
	    resolution_x:640,
	    resolution_y:480,
	    resolution_hd:true
	},
	async mounted(){
	    if(localStorage.config){
		let _config = JSON.parse(localStorage.config)
		for(let k in _config){
		    this.$data[k] = _config[k]
		}
	    }
	    await this.recache()
	    this.section = 'splash'
	    this.first_start = true
	    this.saving = false
	    this.start_enabled = true
	    this.record = false
	    this.cloud_keys = Object.keys(CloudPlatforms)
	    if (this.cloud_key==null || (!(this.cloud_key in this.cloud_config_forms))) this.cloud_key = this.cloud_keys[0]
	    this.cloud_config_forms = {}
	    for(let k of this.cloud_keys){
		this.cloud_config_forms[k] = CloudPlatforms[k]({}).config
		if (!(k in this.cloud_configs)){
		    this.cloud_configs[k] = {}
		}
		for(let config_key in this.cloud_config_forms[k]){
			this.cloud_configs[k][config_key] = this.cloud_configs[k][config_key] || this.cloud_config_forms[k][config_key].init
		}
	    }
	},
	methods:{
	    async recache(){
		this.file_list_cache =  await this.files_list();
		this.cloud_description_cache = this.get_cloud_platform().description
	    },
	    toggle_drop_down(){
		this.drop_down = !this.drop_down
	    },
	    get_cloud_platform(){
		let k = this.cloud_key
		return CloudPlatforms[k](this.cloud_configs[k])
		
	    },
	    async save_config(){
		localStorage.config = JSON.stringify(this.$data)
		await this.recache()
		
	    },
	    async capture(payload){
		this.score = payload.score;
		if(this.score>this.score_threshold) {
		    if(this.record == false){
			recorder = new MediaRecorder(DiffCamEngine.getStream())//.captureStream())
			recorded_frames = []
			recorder.ondataavailable = event => recorded_frames.push(event.data);
			recorder.start();
			
		    }
		    this.record = true;
		    this.last_excess = getSeconds();
		}
		let now =  getSeconds();
		this.now = now //for debug
		if (this.last_excess!=null && ((now - this.last_excess)>this.delta_t_record)){
		    if(this.record==true){
			await recorder.stop()
			await timeout(100)
			this.output_counter+=1
			let format =  "video/webm"
			let recording = document.getElementById("recording");
			let downloadButton = document.getElementById("downloadButton");
			let recordedBlob = new Blob(recorded_frames, { type: format });
			let file_name = (this.camera_name + '_' + (new Date().toISOString()) + this.output_counter.toString()).replace(/[^a-z0-9]/gi,'_')  + '.webm'
			await this.get_cloud_platform().write(file_name, recordedBlob)
			await this.recache()

		    }
		    this.record = false
		}
	    },
	    async file_delete(file_name){
		await this.get_cloud_platform().del(file_name)
		await this.recache()
		this.change('download')

	    },
	    async files_list(){
		return  await this.get_cloud_platform().list()
	    },
	    async file_download(file_name){
		let blob = await this.get_cloud_platform().read(file_name)
		saveByteArray(blob, file_name, "video/webm")
	    },
	    async save_do(){
		console.log('saving..')
		this.saving=true;
		await timeout(1000)
	    this.saving=false;
	    },
	    async file_see(file_name){
		let blob = await this.get_cloud_platform().read(file_name)
		let videoUrl=window.URL.createObjectURL(blob)
		document.getElementById('preview').src = videoUrl;
		this.preview_filename = file_name
		this.change('preview')
	    },
	    start(){
		this.start_enabled = false;
		if (this.first_start){
		    DiffCamEngine.init({
			video: document.getElementById('video'),
			motionCanvas: null,
			initSuccessCallback: ()=>DiffCamEngine.start(),
			initErrorCallback: ()=>console.log('DiffCamEngine.init error'), 
			captureCallback: this.capture
		    });
		    this.first_start = false;
		}    else{
		    DiffCamEngine. restart() 
		}
	    },
	    stop(){
		
		DiffCamEngine.stop()
		this.record = false
		this.start_enabled = true;
	    },
	    change(section){
		this.section = section
		this.drop_down = false
	    }
	    
	}
    })
}
