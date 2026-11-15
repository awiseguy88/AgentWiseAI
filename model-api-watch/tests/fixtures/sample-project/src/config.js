// Config with hard-coded model IDs for the smoke fixture.

module.exports = {
  // Affected: Gemini 4 Carbon doubles Dec 1.
  llm: {
    provider: 'google',
    model: 'gemini-4-carbon',
    fallback: 'gemini-4-argon',
  },
  // Affected: gpt-5.6-sol doubles Jan 1.
  openai: {
    model: 'gpt-5.6-sol',
  },
};