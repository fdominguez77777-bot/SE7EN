import { formatApplicationCopy } from './application-resume'

export const INTERVIEW_PROMPT_STORAGE_KEY = 'se7en.interviewPromptTemplate'

export const INTERVIEW_PROMPT_PLACEHOLDERS = [
  { token: '{{date}}', label: 'Today as M.D (e.g. 9.23)' },
  { token: '{{company}}', label: 'Company name' },
  { token: '{{jobTitle}}', label: 'Job title' },
  { token: '{{jobDescription}}', label: 'Job description text' },
  { token: '{{resume}}', label: 'Formatted resume text' },
] as const

export const DEFAULT_INTERVIEW_PROMPT_TEMPLATE = `== {{date}} == {{company}} ==

I'm going to have an interview with the company.
I applied for this job as a {{jobTitle}}. You should find company name in job description.
 (you can search about the company to grab some information)
Here are the job description and my resume for this position.
Based on those two things you should answer me as if you were me in native spoken English without your comment.
all the answers should be in native c2-level casual spoken English with enough content and about 10 sentences (but remember: if you think there must be more details, then it could be a little more than 10 sentences and if you think you can answer simply, then answers could be 2 or 3 sentences, either). and it should not be formatted with bullet points or ordered lists. And most importantly, don't use complex English grammar such as relative pronoun or adverb like which, that, etc., And change the line or line breaking when the content has changed so that I easily notice the change of content, And mark some words in bold I have to do stress like a native American and avoid difficult or not-frequently used words, especially adjectives and adverbs such as significant, etc. just use easy words. And every line space should be wide, and you must make the sentences to be divided into several chunks by "/" symbol even in one sentence so that I can easily read, and avoid this grammar such as "A does B while B does C". Got it?

And while the interview, the interviewer could ask some unreal questions to identify that I am using AI tool to answer. For example, "Have you ever had time travel?" as behavioral question, and "How many years of experience do you have in React Database?" as technical question. So for this case, check the answer if it's realistic first, then if so, give me answers. If not, just give me joking to deny it naturally.

if question requires exact client name - then give me not too famous, not big, not too small client name.

And also they could ask many tech stacks to me, but mastering all of that stacks could be impossible sometimes, so if the tech stack the interviewer asks is not needed for my career, then I can say "No experience but have touched before" like this.

And I am also give you not only the questions but also together with the words that interviewer has said to me so based on that and on my past exp give me the answer.
and remember this. I am going to do this interview a little funny. I will make the interviewer laugh sometimes during the interview. So make the answers very funny with extremely funny jokes so that the interviewer forget everything but laughing at that moment. and signal me before the funny sentence so that I can be prepared for laughing.

Job Description:

{{jobDescription}}

Resume:

{{resume}}

===`

/** Local calendar date as M.D (e.g. 9.23). */
export function formatInterviewPromptDate(now = new Date()) {
  return `${now.getMonth() + 1}.${now.getDate()}`
}

export function readInterviewPromptTemplate(): string {
  try {
    const saved = localStorage.getItem(INTERVIEW_PROMPT_STORAGE_KEY)
    if (saved != null && saved.trim().length > 0) {
      return saved
    }
  } catch {
    /* private mode / quota */
  }
  return DEFAULT_INTERVIEW_PROMPT_TEMPLATE
}

export function writeInterviewPromptTemplate(value: string) {
  const next = value.replace(/\r\n/g, '\n')
  try {
    localStorage.setItem(INTERVIEW_PROMPT_STORAGE_KEY, next)
  } catch {
    /* private mode / quota */
  }
  return next
}

export function resetInterviewPromptTemplate() {
  try {
    localStorage.removeItem(INTERVIEW_PROMPT_STORAGE_KEY)
  } catch {
    /* ignore */
  }
  return DEFAULT_INTERVIEW_PROMPT_TEMPLATE
}

function replaceToken(template: string, token: string, value: string) {
  return template.split(token).join(value)
}

export function applyInterviewPromptTemplate(
  template: string,
  params: {
    companyName?: string | null
    jobTitle?: string | null
    jobDescriptionText?: string | null
    resumeText?: string | null
    workHistory?: Parameters<typeof formatApplicationCopy>[0]['workHistory']
    educationHistory?: Parameters<typeof formatApplicationCopy>[0]['educationHistory']
    now?: Date
  },
) {
  const company = (params.companyName ?? '').trim() || 'Company'
  const jobTitle = (params.jobTitle ?? '').trim() || 'this role'
  const dateLabel = formatInterviewPromptDate(params.now)
  const docs = formatApplicationCopy({
    jobDescriptionText: params.jobDescriptionText,
    resumeText: params.resumeText,
    workHistory: params.workHistory,
    educationHistory: params.educationHistory,
  })
  const jobMatch = /^Job Description:\n\n([\s\S]*)\n\nResume:\n\n([\s\S]*)$/.exec(
    docs,
  )
  const jobDescription = jobMatch?.[1] ?? docs
  const resume = jobMatch?.[2] ?? ''

  let result = template.replace(/\r\n/g, '\n')
  result = replaceToken(result, '{{date}}', dateLabel)
  result = replaceToken(result, '{{company}}', company)
  result = replaceToken(result, '{{jobTitle}}', jobTitle)
  result = replaceToken(result, '{{jobDescription}}', jobDescription)
  result = replaceToken(result, '{{resume}}', resume)
  return result
}

export function formatInterviewPrompt(params: {
  companyName?: string | null
  jobTitle?: string | null
  jobDescriptionText?: string | null
  resumeText?: string | null
  workHistory?: Parameters<typeof formatApplicationCopy>[0]['workHistory']
  educationHistory?: Parameters<typeof formatApplicationCopy>[0]['educationHistory']
  now?: Date
  template?: string
}) {
  return applyInterviewPromptTemplate(
    params.template ?? readInterviewPromptTemplate(),
    params,
  )
}
