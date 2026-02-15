/**
 * YouTube Data API v3 integration for OAuth2 and video uploading.
 */

const SCOPES = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';

export interface YouTubeConfig {
    clientId: string;
    apiKey: string;
}

export class YouTubeClient {
    private accessToken: string | null = null;
    private clientId: string;

    constructor(config: YouTubeConfig) {
        this.clientId = config.clientId;
    }

    async authenticate(): Promise<void> {
        return new Promise((resolve, reject) => {
            // @ts-ignore
            const client = google.accounts.oauth2.initTokenClient({
                client_id: this.clientId,
                scope: SCOPES,
                callback: (response: any) => {
                    if (response.error) {
                        reject(response);
                    }
                    this.accessToken = response.access_token;
                    resolve();
                },
            });
            client.requestAccessToken();
        });
    }

    async uploadVideo(file: Blob, metadata: { title: string; description: string }): Promise<string> {
        if (!this.accessToken) throw new Error("Not authenticated");

        const metadataBlob = new Blob([JSON.stringify({
            snippet: {
                title: metadata.title,
                description: metadata.description,
                categoryId: '28', // Science & Technology
            },
            status: {
                privacyStatus: 'unlisted',
                selfDeclaredMadeForKids: false,
            }
        })], { type: 'application/json' });

        const form = new FormData();
        form.append('metadata', metadataBlob);
        form.append('file', file);

        const response = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`
            },
            body: form
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return data.id;
    }

    isAuthenticated(): boolean {
        return !!this.accessToken;
    }
}
