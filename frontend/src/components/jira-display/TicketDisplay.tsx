import type { JiraTicket } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { User, Flag, Tag, Paperclip, CheckCircle } from 'lucide-react';

interface TicketDisplayProps {
  ticket: JiraTicket;
}

export function TicketDisplay({ ticket }: TicketDisplayProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'highest':
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
      case 'lowest':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-mono">{ticket.key}</p>
            <CardTitle className="text-lg mt-1">{ticket.summary}</CardTitle>
          </div>
          <Badge className={getPriorityColor(ticket.priority)}>
            <Flag className="w-3 h-3 mr-1" />
            {ticket.priority}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status and Assignee */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant="outline">{ticket.status}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Assignee:</span>
            <span>{ticket.assignee}</span>
          </div>
        </div>

        <Separator />

        {/* Description */}
        {ticket.description && (
          <div>
            <h4 className="text-sm font-medium mb-2">Description</h4>
            <ScrollArea className="h-32 rounded-md border p-3">
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {ticket.description}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Acceptance Criteria */}
        {ticket.acceptanceCriteria && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Acceptance Criteria
            </h4>
            <ScrollArea className="h-24 rounded-md border p-3 bg-muted/50">
              <div className="text-sm whitespace-pre-wrap">
                {ticket.acceptanceCriteria}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Labels */}
        {ticket.labels.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Labels
            </h4>
            <div className="flex flex-wrap gap-2">
              {ticket.labels.map((label) => (
                <Badge key={label} variant="secondary">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Attachments */}
        {ticket.attachments.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              Attachments ({ticket.attachments.length})
            </h4>
            <div className="space-y-1">
              {ticket.attachments.slice(0, 3).map((att) => (
                <div key={att.filename} className="text-sm text-muted-foreground">
                  {att.filename} ({(att.size / 1024).toFixed(1)} KB)
                </div>
              ))}
              {ticket.attachments.length > 3 && (
                <div className="text-sm text-muted-foreground">
                  +{ticket.attachments.length - 3} more
                </div>
              )}
            </div>
          </div>
        )}

        {ticket.cached && (
          <div className="text-xs text-muted-foreground text-right">
            From cache
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TicketDisplay;
