export const languageNames: Record<string,string> = {English:"English", Kannada:"natural conversational Kannada with technical terms in English where appropriate", Hindi:"Hindi", Telugu:"Telugu"};
export const languageRule = (language:string) => `Write all student-facing text in ${languageNames[language] ?? "English"}. Keep technical terms understandable for the student's level.`;
