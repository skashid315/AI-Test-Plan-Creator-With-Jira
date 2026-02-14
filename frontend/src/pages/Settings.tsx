import { useState } from 'react';
import { useSettings } from '../hooks/use-settings';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { Slider } from '../components/ui/slider';
import { toast } from '../hooks/use-toast';
import { Check, X, Loader2, Save, TestTube } from 'lucide-react';

// Groq models
const GROQ_MODELS = [
  { value: 'llama3-70b-8192', label: 'Llama 3 70B' },
  { value: 'llama3-8b-8192', label: 'Llama 3 8B' },
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
  { value: 'gemma-7b-it', label: 'Gemma 7B' },
];

function Settings() {
  const {
    settings,
    loading,
    saveJiraSettings,
    testJiraConnection,
    saveLLMSettings,
    testLLMConnection,
    getOllamaModels,
  } = useSettings();

  // JIRA form state
  const [jiraForm, setJiraForm] = useState({
    baseUrl: '',
    username: '',
    apiToken: '',
  });
  const [testingJira, setTestingJira] = useState(false);
  const [savingJira, setSavingJira] = useState(false);

  // LLM form state
  const [llmForm, setLlmForm] = useState({
    provider: 'groq' as 'groq' | 'ollama',
    groqApiKey: '',
    groqModel: 'llama3-70b-8192',
    groqTemperature: 0.7,
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaModel: 'llama3',
  });
  const [testingLLM, setTestingLLM] = useState(false);
  const [savingLLM, setSavingLLM] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [loadingOllamaModels, setLoadingOllamaModels] = useState(false);

  // Handle JIRA form submit
  const handleSaveJira = async () => {
    if (!jiraForm.baseUrl || !jiraForm.username || !jiraForm.apiToken) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all JIRA fields',
        variant: 'destructive',
      });
      return;
    }

    setSavingJira(true);
    try {
      await saveJiraSettings(jiraForm);
      toast({
        title: 'Success',
        description: 'JIRA settings saved successfully',
      });
      // Clear API token after save
      setJiraForm(prev => ({ ...prev, apiToken: '' }));
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save JIRA settings',
        variant: 'destructive',
      });
    } finally {
      setSavingJira(false);
    }
  };

  // Handle JIRA test
  const handleTestJira = async () => {
    if (!settings?.jira.hasCredentials) {
      toast({
        title: 'Error',
        description: 'Please save JIRA settings first',
        variant: 'destructive',
      });
      return;
    }

    setTestingJira(true);
    try {
      const result = await testJiraConnection();
      if (result.success) {
        toast({
          title: 'Connection Successful',
          description: `Connected as ${result.user}`,
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Connection test failed',
        variant: 'destructive',
      });
    } finally {
      setTestingJira(false);
    }
  };

  // Handle LLM form submit
  const handleSaveLLM = async () => {
    setSavingLLM(true);
    try {
      await saveLLMSettings(llmForm);
      toast({
        title: 'Success',
        description: 'LLM settings saved successfully',
      });
      // Clear API key after save
      setLlmForm(prev => ({ ...prev, groqApiKey: '' }));
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save LLM settings',
        variant: 'destructive',
      });
    } finally {
      setSavingLLM(false);
    }
  };

  // Handle LLM test
  const handleTestLLM = async () => {
    setTestingLLM(true);
    try {
      const result = await testLLMConnection(llmForm.provider);
      if (result.success) {
        toast({
          title: 'Connection Successful',
          description: result.message,
        });
        if (result.models) {
          setOllamaModels(result.models);
        }
      } else {
        toast({
          title: 'Connection Failed',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Connection test failed',
        variant: 'destructive',
      });
    } finally {
      setTestingLLM(false);
    }
  };

  // Load Ollama models
  const handleLoadOllamaModels = async () => {
    setLoadingOllamaModels(true);
    try {
      const models = await getOllamaModels();
      setOllamaModels(models);
      if (models.length === 0) {
        toast({
          title: 'No Models Found',
          description: 'No Ollama models found. Please pull a model first.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Models Found',
          description: `Found ${models.length} Ollama models`,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load Ollama models',
        variant: 'destructive',
      });
    } finally {
      setLoadingOllamaModels(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your JIRA integration and LLM provider settings.
        </p>
      </div>

      <Tabs defaultValue="jira" className="space-y-4">
        <TabsList>
          <TabsTrigger value="jira">JIRA Configuration</TabsTrigger>
          <TabsTrigger value="llm">LLM Provider</TabsTrigger>
        </TabsList>

        {/* JIRA Settings */}
        <TabsContent value="jira">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                JIRA Configuration
                {settings?.jira.isConnected ? (
                  <Badge variant="default" className="bg-green-500">
                    <Check className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                ) : settings?.jira.hasCredentials ? (
                  <Badge variant="destructive">
                    <X className="w-3 h-3 mr-1" />
                    Not Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not Configured</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Connect to your JIRA instance to fetch tickets. Get your API token from{' '}
                <a
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Atlassian Account Settings
                </a>
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="jira-url">JIRA Base URL</Label>
                <Input
                  id="jira-url"
                  placeholder="https://your-domain.atlassian.net"
                  value={jiraForm.baseUrl}
                  onChange={(e) => setJiraForm({ ...jiraForm, baseUrl: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Example: https://company.atlassian.net
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="jira-username">Username / Email</Label>
                <Input
                  id="jira-username"
                  type="email"
                  placeholder="your-email@example.com"
                  value={jiraForm.username}
                  onChange={(e) => setJiraForm({ ...jiraForm, username: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="jira-token">API Token</Label>
                <Input
                  id="jira-token"
                  type="password"
                  placeholder="••••••••••••••••••••"
                  value={jiraForm.apiToken}
                  onChange={(e) => setJiraForm({ ...jiraForm, apiToken: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Your API token is encrypted before storage.
                </p>
              </div>

              {settings?.jira.hasCredentials && (
                <div className="rounded-md bg-muted p-4">
                  <p className="text-sm font-medium">Current Configuration</p>
                  <p className="text-sm text-muted-foreground">URL: {settings.jira.baseUrl}</p>
                  <p className="text-sm text-muted-foreground">User: {settings.jira.username}</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button
                onClick={handleSaveJira}
                disabled={savingJira}
              >
                {savingJira ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save JIRA Settings
              </Button>
              <Button
                variant="outline"
                onClick={handleTestJira}
                disabled={testingJira || !settings?.jira.hasCredentials}
              >
                {testingJira ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4 mr-2" />
                )}
                Test Connection
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* LLM Settings */}
        <TabsContent value="llm">
          <Card>
            <CardHeader>
              <CardTitle>LLM Provider Settings</CardTitle>
              <CardDescription>
                Choose between Groq (cloud) or Ollama (local) for test plan generation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Provider Selection */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Use Local LLM (Ollama)</Label>
                  <p className="text-sm text-muted-foreground">
                    Toggle between Groq (cloud) and Ollama (local)
                  </p>
                </div>
                <Switch
                  checked={llmForm.provider === 'ollama'}
                  onCheckedChange={(checked) =>
                    setLlmForm({ ...llmForm, provider: checked ? 'ollama' : 'groq' })
                  }
                />
              </div>

              {llmForm.provider === 'groq' ? (
                // Groq Settings
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="groq-key">Groq API Key</Label>
                    <Input
                      id="groq-key"
                      type="password"
                      placeholder="gsk_..."
                      value={llmForm.groqApiKey}
                      onChange={(e) => setLlmForm({ ...llmForm, groqApiKey: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Get your API key from{' '}
                      <a
                        href="https://console.groq.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Groq Console
                      </a>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="groq-model">Model</Label>
                    <select
                      id="groq-model"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={llmForm.groqModel}
                      onChange={(e) => setLlmForm({ ...llmForm, groqModel: e.target.value })}
                    >
                      {GROQ_MODELS.map((model) => (
                        <option key={model.value} value={model.value}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Temperature: {llmForm.groqTemperature}</Label>
                    <SimpleSlider
                      value={[llmForm.groqTemperature]}
                      onValueChange={([value]) => setLlmForm({ ...llmForm, groqTemperature: value })}
                      min={0}
                      max={1}
                      step={0.1}
                    />
                    <p className="text-xs text-muted-foreground">
                      Lower = more focused, Higher = more creative
                    </p>
                  </div>

                  {settings?.llm.groq.hasApiKey && (
                    <Badge variant="secondary">API Key Configured</Badge>
                  )}
                </div>
              ) : (
                // Ollama Settings
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ollama-url">Ollama Base URL</Label>
                    <Input
                      id="ollama-url"
                      placeholder="http://localhost:11434"
                      value={llmForm.ollamaBaseUrl}
                      onChange={(e) => setLlmForm({ ...llmForm, ollamaBaseUrl: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ollama-model">Model</Label>
                    <div className="flex gap-2">
                      <Input
                        id="ollama-model"
                        placeholder="llama3"
                        value={llmForm.ollamaModel}
                        onChange={(e) => setLlmForm({ ...llmForm, ollamaModel: e.target.value })}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleLoadOllamaModels}
                        disabled={loadingOllamaModels}
                      >
                        {loadingOllamaModels ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Refresh'
                        )}
                      </Button>
                    </div>
                  </div>

                  {ollamaModels.length > 0 && (
                    <div className="space-y-2">
                      <Label>Available Models</Label>
                      <div className="flex flex-wrap gap-2">
                        {ollamaModels.map((model) => (
                          <Badge
                            key={model}
                            variant={llmForm.ollamaModel === model ? 'default' : 'outline'}
                            className="cursor-pointer"
                            onClick={() => setLlmForm({ ...llmForm, ollamaModel: model })}
                          >
                            {model}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-md bg-muted p-4">
                    <p className="text-sm">
                      Make sure Ollama is running. Install from{' '}
                      <a
                        href="https://ollama.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        ollama.com
                      </a>
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button onClick={handleSaveLLM} disabled={savingLLM}>
                {savingLLM ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save LLM Settings
              </Button>
              <Button variant="outline" onClick={handleTestLLM} disabled={testingLLM}>
                {testingLLM ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4 mr-2" />
                )}
                Test Connection
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Simple Slider component since we didn't create it
function SimpleSlider({
  value,
  onValueChange,
  min,
  max,
  step,
}: {
  value: number[];
  onValueChange: (value: number[]) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value[0]}
      onChange={(e) => onValueChange([parseFloat(e.target.value)])}
      className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
    />
  );
}

export default Settings;
