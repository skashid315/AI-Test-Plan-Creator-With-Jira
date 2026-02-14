import { useState, useEffect } from 'react';
import { testplanApi } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { toast } from '../hooks/use-toast';
import type { TestPlanHistory } from '../types';
import { 
  Search, 
  Loader2, 
  Trash2, 
  Download, 
  RefreshCw, 
  FileText, 
  Calendar,
  Bot,
  ChevronRight,
  X
} from 'lucide-react';

function History() {
  const [history, setHistory] = useState<TestPlanHistory[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<TestPlanHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<TestPlanHistory | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Load history
  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await testplanApi.getHistory(50);
      setHistory(response.data);
      setFilteredHistory(response.data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadHistory();
  }, []);

  // Filter history
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredHistory(history);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = history.filter(
      (item) =>
        item.ticketKey.toLowerCase().includes(query) ||
        (item.ticketSummary && item.ticketSummary.toLowerCase().includes(query)) ||
        item.llmProvider.toLowerCase().includes(query)
    );
    setFilteredHistory(filtered);
  }, [searchQuery, history]);

  // Delete item
  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this test plan?')) {
      return;
    }

    try {
      await testplanApi.deleteTestPlan(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
      toast({
        title: 'Deleted',
        description: 'Test plan removed from history',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete test plan',
        variant: 'destructive',
      });
    }
  };

  // Download item
  const handleDownload = async (item: TestPlanHistory, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const blob = new Blob([item.generatedContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-plan-${item.ticketKey}-${item.id}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Downloaded',
        description: 'Test plan downloaded successfully',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to download',
        variant: 'destructive',
      });
    }
  };

  // Open preview
  const handlePreview = (item: TestPlanHistory) => {
    setSelectedItem(item);
    setPreviewOpen(true);
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Get provider badge color
  const getProviderColor = (provider: string) => {
    return provider === 'groq' 
      ? 'bg-blue-500 hover:bg-blue-600' 
      : 'bg-green-500 hover:bg-green-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">History</h1>
          <p className="text-muted-foreground">
            View and manage previously generated test plans.
          </p>
        </div>
        <Button variant="outline" onClick={loadHistory} disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by ticket ID or summary..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {searchQuery && (
          <Button variant="ghost" onClick={() => setSearchQuery('')}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>Total: {history.length}</span>
        {searchQuery && <span>Filtered: {filteredHistory.length}</span>}
      </div>

      {/* History List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredHistory.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {searchQuery 
                ? 'No test plans match your search' 
                : 'No test plans generated yet. Go to Generate to create one!'}
            </p>
            {!searchQuery && (
              <Button className="mt-4" asChild>
                <a href="/generate">Generate Test Plan</a>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredHistory.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handlePreview(item)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{item.ticketKey}</span>
                        <Badge className={getProviderColor(item.llmProvider)}>
                          <Bot className="w-3 h-3 mr-1" />
                          {item.llmProvider}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {item.ticketSummary || 'No summary available'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {formatDate(item.createdAt)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {(item.generatedContent.length / 1000).toFixed(1)}k characters
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDownload(item, e)}
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDelete(item.id, e)}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewOpen && selectedItem && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <Card 
            className="w-full max-w-4xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {selectedItem.ticketKey}
                  <Badge className={getProviderColor(selectedItem.llmProvider)}>
                    {selectedItem.llmProvider}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Generated on {formatDate(selectedItem.createdAt)}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(selectedItem, {} as React.MouseEvent)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPreviewOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 p-0">
              <ScrollArea className="h-[60vh]">
                <div className="p-6">
                  <pre className="text-sm whitespace-pre-wrap font-mono">
                    {selectedItem.generatedContent}
                  </pre>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default History;
