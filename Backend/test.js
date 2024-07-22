const { GoogleGenerativeAI, ExecutableCodeLanguage } = require('@google/generative-ai');
const { Configuration, OpenAIApi, default: OpenAI } = require('openai');
const ytdl = require('ytdl-core');
const fs = require('fs');
const { exec } = require('child_process');
const YouTubeTranscriptApi = require('youtube-transcript-api');
const express=require("express")
app=express();
const cors=require("cors")
app.use(express.json())
app.use(cors())
// Takeing the API_KEY from the google studio it takes the our logins and generate the API_KEY
const genAI = new GoogleGenerativeAI("AIzaSyDLvb6js3llevV9xAM2dWfyVwj_mGKAebM");

// Initialize Gemini model
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });




async function downloadAndRenameAudio(url, newName = 'audio1') {
    return new Promise((resolve, reject) => {
      const command = `yt-dlp --extract-audio --audio-format mp3 --output "${newName}.%(ext)s" ${url}`;
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error: ${error.message}`);
          return reject(error);
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
        }
        
        const files = fs.readdirSync('.');
        const audioFile = files.find(file => file.startsWith(newName) && file.endsWith('.mp3'));
        
        if (!audioFile) {
          console.error('Error: No downloaded audio file found.');
          return reject(new Error('No audio file found'));
        }
        
        const newFilePath = `./${audioFile}`;
        resolve(newFilePath);
      });
    });
  }
  
  async function getTranscriptText(videoId) {
    try {
      const transcript = await YouTubeTranscriptApi.getTranscript(videoId,{language:"en"});
      const transcriptText = transcript.map(entry => entry.text).join(' ');
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      await downloadAndRenameAudio(videoUrl);
      return transcriptText;
    } catch (error) {
      console.error('Error occurred while getting transcript');
      console.log('Using OpenAI to convert the YouTube video into text');
      return null;
    }
  }


  var knowledgeBase;

  app.use("/start", async (req,res,next) => {
    const id1 = req.query.id
    console.log(id1);
    try {
      const transcriptText = await getTranscriptText(id1);
      if (transcriptText) {
        knowledgeBase = transcriptText;
      } else {
        console.log("Using OpenAI's Whisper API for transcription");
        const resp = await OpenAI.createTranscription(
          fs.createReadStream("audio1.mp3"),
          "whisper-1"
        );
        knowledgeBase = resp.data.text;
      }
      //console.log(knowledgeBase)
      next();
    } catch (error) {
      console.error('An error occurred:', error);
    }
  });
  app.get("/start/summary", async (req, res) => {
    console.log("hello buddy");
    const summaryPrompt = `You are an expert in English Language
                           Now your task is to summarize the given content into 250 words and remove any grammatical mistakes.
                           The summary is :- ${knowledgeBase}
                           Generate the Important points in each line`;
  
    try {
      const summaryResponse = await model.generateContent(summaryPrompt);
      console.log(summaryResponse.response.text());
      return res.json({"summary":summaryResponse.response.text()});
    } catch (error) {
      console.error('An error occurred:', error);
      res.status(500).send('Error generating summary');
    }
  });
  
  app.get("/start/question", async (req, res) => {
    const question=req.query.question;
    console.log(question);
    const prompt = `You are an expert in finding answers or matching answers for the asked question from the Knowledge Base Given below.
                    Your task is to analyze the complete Knowledge Base and answer the questions asked.
                    The Knowledge Base is : ${knowledgeBase}
                    The Question is: ${question}
                    The Output Must be only the answer generated.`;
  
    try {
      const FirstResponse = await model.generateContent(prompt);
      //console.log("Answer:", FirstResponse.response.text());
      return res.json({"answer":FirstResponse.response.text()});
    } catch (error) {
      console.error('An error occurred:', error);
      res.status(500).send('Error generating response');
    }
  });

  app.get("/start/list", async (req, res) => {
    const questionsPrompt = `You are an expert in framing the number of questions asked.
                             Your task is to analyze the complete Knowledge Base and generate the number of questions asked.
                             The Knowledge Base is : ${knowledgeBase}
                             The Number of Questions need to be Generated is ${7}
                             The output must be in json format that questions={1:{question:question,answer:answer}} upto specified number of questions`;
  
    try {
      const questionResponse = await model.generateContent(questionsPrompt);
      console.log(questionResponse.response.text());
      return res.json({"Questions":questionResponse.response.text()});
    } catch (error) {
      console.error('An error occurred:', error);
      res.status(500).send('Error generating questions');
    }
  });

  
app.get("/start/mcqs", async (req, res) => {
    const nq = req.query.mcq;
    const mcqsPrompt = `You are an expert in framing the number of MCQ questions asked.
                        Your task is to analyze the complete Knowledge Base and generate the number of questions asked.
                        The Knowledge Base is : ${knowledgeBase}
                        The Number of Questions need to be Generated is ${nq}
                        The output must be in json format  like {"questions":{"question":<Question>,options:["generate 4 options for question"],correctOption:choose correct option number from options start at index 0, points:10},{"question":<Question>,options:["generate 4 options for question"],correctOption:choose correct option number from options array, points:10}}}}} avoid giving \n and \ in and remove output upto specified number of questions`;
  
    try {
      const mcqsResponse = await model.generateContent(mcqsPrompt);
      //console.log((mcqsResponse.response.text()));
      let val=mcqsResponse.response.text();
      const cleanedJsonString = val.replace("```json", '');
      const cleaned= cleanedJsonString.replace("```", '');
      console.log(cleaned);
      let jsonData;
      try {
        jsonData = JSON.parse(cleaned);
    } catch (error) {
        console.error('Error parsing JSON:', error);
        return res.status(500).send('Error parsing generated JSON');
    }
      return res.send(jsonData);
    } catch (error) {
      console.error('An error occurred:', error);
      res.status(500).send('Error generating MCQs');
    }
  });
  
   
app.listen(5000,()=>console.log("current listening port is 5000"));