import { useState, useEffect } from 'react';
import { Comment, Attachment } from '@/types';
import { commentsService, tasksService } from '@/services/firebase.service';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { MessageSquare, Send, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { PageLoader } from '@/components/PageLoader';

interface TaskCommentsProps {
  taskId: string;
  inputIdSuffix?: string;
}

export function TaskComments({ taskId, inputIdSuffix }: TaskCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    
    // Escuchar cambios en los comentarios en tiempo real
    const unsubscribe = commentsService.listen(taskId, (commentsData) => {
      setComments(commentsData);
      setLoading(false);
    });

    return unsubscribe;
  }, [taskId]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    if (!newComment.trim() || !user) return;

    setSubmitting(true);
    
    try {

      const commentData: Partial<Comment> = {
        taskId,
        userId: user.id,
        userDisplayName: user.displayName,
        userPhotoURL: (user as any).photoURL || null,
        content: newComment.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await commentsService.create(commentData as any);

      toast.success('Comentario agregado');
      setNewComment('');
    } catch (error: any) {
      toast.error(error?.message || 'Error al agregar comentario');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <PageLoader overlay={false} message="Cargando comentarios..." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comentarios
          <span className="text-sm font-normal text-muted-foreground">
            ({comments.length})
          </span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Lista de comentarios */}
        {comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay comentarios aún</p>
            <p className="text-sm">Sé el primero en comentar</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-8 w-8">
                  <div className="h-full w-full flex items-center justify-center bg-primary text-primary-foreground text-sm">
                    {(comment.userDisplayName || comment.userId || '?').toString().charAt(0).toUpperCase()}
                  </div>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">
                      {comment.userId === user?.id ? 'Tú' : (comment.userDisplayName || 'Usuario')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(comment.createdAt, { 
                        addSuffix: true, 
                        locale: es 
                      })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {comment.content}
                  </p>
                  {comment.attachment && (
                    <div className="mt-2">
                      {comment.attachment.url && /(png|jpe?g|gif|webp)$/i.test(comment.attachment.name) ? (
                        <a href={comment.attachment.url} target="_blank" rel="noreferrer" className="block rounded overflow-hidden">
                          <img src={comment.attachment.url} alt={comment.attachment.name} className="max-h-40 object-cover rounded" />
                        </a>
                      ) : (
                        <a href={comment.attachment.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary underline">
                          📎 {comment.attachment.name}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Formulario para nuevo comentario (con adjuntos) */}
        <div className="flex gap-2 items-end">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Escribe un comentario..."
            className="flex-1 rounded-md border bg-input text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm resize-none"
            rows={2}
            disabled={submitting}
          />

          <div className="flex flex-col items-center gap-2">
            <input id={`comment-file-${taskId}${inputIdSuffix ? `-${inputIdSuffix}` : ''}`} type="file" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !user) return;
              setSubmitting(true);
              try {
                const attachment = await tasksService.uploadAttachment(taskId, file, user.id);
                // create a comment that references the attachment
                const commentData: Partial<Comment> = {
                  taskId,
                  userId: user.id,
                  userDisplayName: user.displayName,
                  userPhotoURL: (user as any).photoURL || null,
                  content: `Adjunto: ${attachment.name}`,
                  attachment: attachment as Attachment,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                await commentsService.create(commentData as any);
                toast.success('Archivo adjuntado y comentario creado');
              } catch (err: any) {
                console.error(err);
                toast.error('Error al adjuntar archivo');
              } finally {
                setSubmitting(false);
                // reset input value to allow same file again
                (e.target as HTMLInputElement).value = '';
              }
            }} />
            <label htmlFor={`comment-file-${taskId}${inputIdSuffix ? `-${inputIdSuffix}` : ''}`} className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-muted hover:bg-muted/80 cursor-pointer" title="Adjuntar archivo">
              <Plus className="h-4 w-4" />
            </label>

            <Button
              type="button"
              size="sm"
              disabled={!newComment.trim() || submitting}
              onClick={() => handleSubmit()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
