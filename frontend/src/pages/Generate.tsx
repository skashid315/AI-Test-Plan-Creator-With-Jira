import { useState, useRef } from 'react';
import { jiraApi, templatesApi, testplanApi } from '../services/api';
import { TicketDisplay } from '../components/jira-display/TicketDisplay';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { ScrollArea } from '../components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { toast } from '../hooks/use-toast';
import type { JiraTicket, Template, GenerationProgress } from '../types';
import { Search, Loader2, Sparkles, Copy, Download, RotateCcw, FileText } from 'lucide-react';

function Generate() {
  // Ticket input state
  const [ticketId, setTicketId] = useState('');
  const [fetchingTicket, setFetchingTicket] = useState(false);
  const [ticket, setTicket] = useState<JiraTicket | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);

  // Templates state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>();
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatedContent, setGeneratedContent] = useState('');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Provider selection
  const [provider, setProvider] = useState<'groq' | 'ollama'>('groq');

  // Fetch ticket
  const handleFetchTicket = async () => {
    if (!ticketId.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a JIRA ticket ID',
        variant: 'destructive',
      });
      return;
    }

    setFetchingTicket(true);
    setTicketError(null);
    setTicket(null);

    try {
      const response = await jiraApi.fetchTicket(ticketId.trim().toUpperCase());
      setTicket(response.data);
      toast({
        title: 'Success',
        description: `Fetched ticket: ${response.data.summary}`,
      });

      // Load templates
      await loadTemplates();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch ticket';
      setTicketError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setFetchingTicket(false);
    }
  };

  // Load templates
  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const response = await templatesApi.getAllTemplates();
      setTemplates(response.data);
      // Select default template
      const defaultTemplate = response.data.find(t => t.isDefault);
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
      }
    } catch (error) {
      console.error('Failed to load templates', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Generate test plan
  const handleGenerate = async () => {
    if (!ticket) return;

    setGenerating(true);
    setGenerationProgress(0);
    setGeneratedContent('');
    setGenerationError(null);

    try {
      // Use sync version for simpler implementation
      const response = await testplanApi.generateSync(
        ticket.key,
        provider,
        selectedTemplateId
      );

      setGeneratedContent(response.data.content);
      setGenerationProgress(100);

      toast({
        title: 'Success',
        description: 'Test plan generated successfully',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generation failed';
      setGenerationError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedContent);
      toast({
        title: 'Copied',
        description: 'Test plan copied to clipboard',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  // Download as markdown
  const handleDownload = () => {
    const blob = new Blob([generatedContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-plan-${ticket?.key || 'generated'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Downloaded',
      description: 'Test plan downloaded as Markdown',
    });
  };

  // Reset
  const handleReset = () => {
    setTicketId('');
    setTicket(null);
    setTicketError(null);
    setTemplates([]);
    setSelectedTemplateId(undefined);
    setGenerating(false);
    setGenerationProgress(0);
    setGeneratedContent('');
    setGenerationError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Generate Test Plan</h1>
          <p className="text-muted-foreground">
            Enter a JIRA ticket ID to generate a comprehensive test plan.
          </p>
        </div>
        {(ticket || generatedContent) && (
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Start Over
          </Button>
        )}
      </div>

      {/* Step 1: Ticket Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
              1
            </span>
            Enter JIRA Ticket
          </CardTitle>
          <CardDescription>
            Enter the ticket ID (e.g., VWO-123) to fetch from JIRA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="VWO-123"
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFetchTicket()}
                disabled={fetchingTicket || !!ticket}
              />
            </div>
            <Button
              onClick={handleFetchTicket}
              disabled={fetchingTicket || !!ticket}
            >
              {fetchingTicket ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              Fetch Ticket
            </Button>
          </div>

          {ticketError && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{ticketError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Ticket Display & Template Selection */}
      {ticket && (
        <div className="grid gap-6 lg:grid-cols-2">
          <TicketDisplay ticket={ticket} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                  2
                </span>
                Configure Generation
              </CardTitle>
              <CardDescription>
                Select template and LLM provider
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template Selection */}
              <div className="space-y-2">
                <Label>Template</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={selectedTemplateId || ''}
                  onChange={(e) => setSelectedTemplateId(Number(e.target.value) || undefined)}
                  disabled={loadingTemplates}
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} {template.isDefault && '(Default)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Provider Selection */}
              <div className="space-y-2">
                <Label>LLM Provider</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={provider === 'groq' ? 'default' : 'outline'}
                    onClick={() => setProvider('groq')}
                    className="flex-1"
                  >
                    Groq (Cloud)
                  </Button>
                  <Button
                    type="button"
                    variant={provider === 'ollama' ? 'default' : 'outline'}
                    onClick={() => setProvider('ollama')}
                    className="flex-1"
                  >
                    Ollama (Local)
                  </Button>
                </div>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full"
                size="lg"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {generating ? 'Generating...' : 'Generate Test Plan'}
              </Button>

              {generating && (
                <div className="space-y-2">
                  <Progress value={generationProgress} />
                  <p className="text-sm text-muted-foreground text-center">
                    Generating test plan... {generationProgress}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Generated Output */}
      {generatedContent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-primary-foreground text-sm">
                3
              </span>
              Generated Test Plan
            </CardTitle>
            <CardDescription>
              Review and export your test plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopy}>
                <Copy className="w-4 h-4 mr-2" />
                Copy to Clipboard
              </Button>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download Markdown
              </Button>
            </div>

            <ScrollArea className="h-96 rounded-md border">
              <div className="p-4">
                <pre className="text-sm whitespace-pre-wrap font-mono">
                  {generatedContent}
                </pre>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {generationError && (
        <Alert variant="destructive">
          <AlertTitle>Generation Failed</AlertTitle>
          <AlertDescription>{generationError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default Generate;
