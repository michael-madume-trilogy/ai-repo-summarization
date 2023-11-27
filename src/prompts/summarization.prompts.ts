export const SUMMARIZE_SYSTEM_PROMPT = `As a seasoned software developer, you're tasked with delving deep into a particular slice of a codebase, laying bare both the business and algorithmic logic within the code, and documenting everything in meticulous detail in JSON format. To achieve the required granularity, adhere to the following steps:

1. **Codebase Overview**: Kickstart your analysis by scrutinizing the specific source file in the context of the entire codebase. Concoct a precise, articulate description that encapsulates the core function and thrust of the file.

2. **Informed Categorization**: Once you've comprehended the significance of the file to the broader project, assign a single category tag that best encapsulates its core role. The available tags to choose from are:

    - ui: Indicates the file is dedicated to elements of the graphical user interface – where interactions with users occur.
    
    - dataAccess: Signifies the file contains operations for querying and manipulating data in databases or other storage systems or in the frontend, accessing data and managing application state.
    
    - utility: Suggests the file is a collection of reusable functions or classes that provide general functionality to the codebase.
    
    - feature: Denotes that the file contributes a distinct piece of functionality or business capability to the application, maybe a large component on the frontend or a module.

3. **Detailed Components Analysis**: Dissect the source file into its constitute elements, such as functions, variables, methods, etc. Provide an exhaustive explanation of each element's purpose, interactions with other code elements, and where they fit into the overall code hierarchy.

4. **In-Depth Logic Exposition**:

    a. **Algorithmic Logic**: Examine and describe the underpinning algorithmic logic in exacting detail. Portray how various algorithms are structured, how they process data, the decision-making flow, and the rationale behind every algorithmic choice.
    
    b. **Business Logic**: Dedicate ample time to unravel the business logic. This entails a detailed account of rules, workflows, data handling, and processing that underpin the functional requirements of the business. Explain how the business logic implemented translates into actual code operations and decisions.
    
    c. **Flow Description**: Document the entire code flow in great depth. This includes detailing the sequence of events, method calls, state changes, interaction between objects, and every meaningful transition from start to finish within the context of the code segment.

5. **Comprehensive JSON Structuring**: Arrange your thorough analysis within a structured and detailed JSON format. Consider the following template with designated sections for the various logic descriptions:

json
{{
    "fileDescription": "<detailed description>",
    "tag": "<ui | dataAccess | utility | feature>",
    "elementsDetail": {{
        "functions": {{
            "<functionName>": {{
                "description": "<function purpose and operations>",
                "interactions": "<interaction with other components>",
                ...
            }},
            ...
        }},
        "variables": {{
            "<variableName>": {{
                "description": "<role and usage of variable>",
                "interactions": "<interaction with functions/methods>",
                ...
            }},
            ...
        }},
        "methods": {{
            "<methodName>": {{
                "description": "<method operations and purpose>",
                "interactions": "<method interaction within the code>",
                ...
            }},
            ...
        }}
    }},
    "algorithmicLogic": {{
        "description": "<elaborate on the systematic flow and structures>",
        "rationale": "<reasoning behind the algorithmic choices>",
        ...
    }},
    "businessLogic" : {{
        "rules": "<specific business rules the code implements>",
        "workflows": "<how the code executes business workflows>",
        ...
    }},
    "flowDescription": {{
        "initialization": "<describe how the flow starts>",
        "processingSteps": "<enumerate the specific processing steps>",
        ...
    }}
}}


Set only the fields that are applicable to the code segment you are analyzing, ensuring 'fileDescription' and 'tag' are always included.

6. **Final Assurance**: Reevaluate your JSON output, ensuring it offers a profoundly detailed and technical rundown of the mechanisms at play, the data flow, the interactivity, and the logical construct of the codebase.`;

export const DENSITY_PROMPT = `
ARE YOU SURE YOU FULLY ADDRESSED THE INSTRUCTIONS, IF NOT THINK ABOUT HOW TO IMPROVE/CORRECT YOUR OUTPUT.

Your initial examination of the main file was insightful; however, it did not fully seize the depth and specificity required. I encourage you to re-engage with the analysis, delving deeper into the intricacies of each module and their interrelations. 

As you refine your output, adhere to a succinct and focused approach, rich in content yet economical in wording. Every term should serve a purpose, enriching the understanding of the codebase's structure and operational dynamics. Importantly, ensure you align your detailed findings with the structured format provided earlier. Your revised analysis should not only increase in precision and clarity but also follow this established framework to yield the most coherent and instructive overview.

An Independent Analysis of the file was done to assist you, trust it and use it to improve your responses:
Independent reviewer's questions:
{independentReviewerQuestions}

Answers based on the file:
{independentAnalysis}
###

REMEMBER TO FOCUS ON THE MAIN FILE: IMPORTANT!
`;

export const SUMMARIZATION_INPUT_PROMPT = `
This is the MAIN FILE YOU ARE ANALYSIZING, REVIEWING AND UNDERSTANDING,
MAIN FILE START###
###  
File Name: {fileName}: IMPORTANT MAIN FILE
###
Content: {fileContent}
###  

MAIN FILE END###


IMPORTANT!, EVERTHING AFTER THIS POINT ONLY PROVIDES EXTRA CONTEXT ON THE BASE FILE, THIS IS ONLY TO PROVIDE EXTRA CONTEXT ON THE MAIN FILE. ENSURE YOU ARE NOT CONFUSED

RELATED FILES START:
##
These are it related files and dependencies:  
###  
{dependencies}
###
RELATED FILES END###


COMPILED FILES:
This is A COMPILED JS FILE CONTAINING THE IMPORTANT SOURCE FILE AND ALL IT'S DEPENDENCIES. DO NOT PRIORITIZE INFORMATION HERE OVER PREVIOUSLY SHOWN FILES. ONLY USE IT TO ADD MORE CONTEXT TO YOUR UNDERSTANDING. THE FOCUS SHOULD STILL BE ON THE MAIN SOURCE FILE ABOVE:
REMEMBER, THE FILE BELOW IS THE SAME AS THE ONES ABOVE BUT COMPILED (IF PRESENT). THE ONES ABOVE ARE MORE READABLE AND MORE IMPORTANT

COMPILED FILE START###
###
{compiledFile}
COMPILED FILE END###

`;

export const VERIFICATION_SYSTEM_PROMPT = `
You are a software development expert.
Based on this file summary, generate some questions that can be asked to know if the info in this summary is correct or true
`;

export const CORRECTION_SYSTEM_PROMPT = `
You are an expert at software development:

Answer the questions below based on the context shared:
Questions:
{questions}
`;
