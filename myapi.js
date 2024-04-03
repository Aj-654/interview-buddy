require('dotenv').config();
const OpenAI = require('openai').OpenAI;
const openai = new OpenAI(process.env.OPENAI_API_KEY);


// Function to be exposed globally
async function myapi(alltext) {
  const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
          {
            role: 'user',
            content: "Create a list of 8 interview questions from skills, experience and projects in this text: " + alltext  
          }
      ]
  });
  return response.choices[0].message.content;
}

async function myapi2(questionanswers) {
  const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
          {
            role: 'user',
            content: "I am providing you with some questions whose answers were recorded and converted into text. it is an interview. Evalaute these answers and give them score Indiviually based on how correct and relevant the answer is to the question. also give the score of the overall interview. Provide feedback on overall delivery, how the speech can be improved, grammar and language of the answers. do all of this pointwise  " + questionanswers  
          }
      ]
  });
  return response.choices[0].message.content;
}
module.exports = {
  myapi,
  myapi2
};