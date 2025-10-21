/* global console, Office, fetch */

import {buildEmailMetadata} from "./helpers/emailMetadata";
import {getPlainTextBody} from "./helpers/emailBodyService";

export interface PipelineResponse {
    message: string;
    questionMatch: Record<string, unknown> | null;
    assistantResponse: {
        emailResponse: string | null;
        sourceCitations: Array<{
            url: string | null;
            title: string | null;
        }>;
    };
}

export async function sendText(
    optionalPrompt?: string,
    options?: { signal?: AbortSignal }
): Promise<PipelineResponse> {
    try {
        console.info("[Taskpane] Generate response button pressed. Retrieving email body...");
        // Retrieve the body of the current email as plain text so it can be sent to the backend.
        const bodyText = await getPlainTextBody();
        console.info(
            `[Taskpane] Email body retrieved (${bodyText.length} characters). Preparing to post to the logging service...`
        );
        // Build a metadata payload (subject, sender, conversation info) to accompany the body content.
        const metadata = await buildEmailMetadata();

        // Post the email content to the local development server for logging.
        // The payload includes both the raw text and the metadata envelope so downstream
        // services have enough context to store, index, or reply to the message.

        // todo: eww!
        const response = await fetch(`http://localhost:4000/log-text`, {

        // const response = await fetch(`https://outlook-add-in-kdr8.onrender.com/log-text`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                text: bodyText,
                metadata,
                optionalPrompt: optionalPrompt?.trim() || undefined,
            }),
            signal: options?.signal,
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `[Taskpane] Logging service responded with ${response.status}: ${errorText || response.statusText}`
            );
        }

        const responsePayload = (await response.json()) as PipelineResponse;
        console.info("[Taskpane] Email content successfully posted to the logging service.");
        return responsePayload;
    } catch (error) {
        console.log("Error: " + error);
        throw error;
    }
}
