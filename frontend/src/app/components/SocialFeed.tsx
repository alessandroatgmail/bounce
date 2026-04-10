import { useState } from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Heart, MessageCircle, Send } from 'lucide-react';
import { Post, mockStudents } from '../data/mockData';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { it, enUS } from 'date-fns/locale';

interface SocialFeedProps {
  posts: Post[];
  onAddPost: (content: string) => void;
  onLikePost: (postId: string) => void;
  onAddComment: (postId: string, content: string) => void;
}

export function SocialFeed({ posts, onAddPost, onLikePost, onAddComment }: SocialFeedProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [newPost, setNewPost] = useState('');
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});

  const getUserName = (userId: string) => {
    const student = mockStudents.find(s => s.id === userId);
    return student?.name || 'Unknown User';
  };

  const getUserInitials = (userId: string) => {
    const name = getUserName(userId);
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const handleSubmitPost = () => {
    if (newPost.trim()) {
      onAddPost(newPost.trim());
      setNewPost('');
    }
  };

  const handleSubmitComment = (postId: string) => {
    const content = commentInputs[postId];
    if (content?.trim()) {
      onAddComment(postId, content.trim());
      setCommentInputs({ ...commentInputs, [postId]: '' });
    }
  };

  const toggleComments = (postId: string) => {
    setShowComments(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const sortedPosts = [...posts].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Create Post */}
      <Card>
        <CardHeader>
          <div className="flex gap-3">
            <Avatar>
              <AvatarFallback className="bg-[#e67e22] text-white">
                {user ? getUserInitials(user.id) : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Textarea
                placeholder={language === 'it' 
                  ? 'Condividi i tuoi pensieri con la community...' 
                  : 'Share your thoughts with the community...'}
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <div className="flex justify-end mt-2">
                <Button
                  onClick={handleSubmitPost}
                  disabled={!newPost.trim()}
                  className="bg-[#e67e22] hover:bg-[#d4b896]"
                >
                  <Send className="size-4 mr-2" />
                  {language === 'it' ? 'Pubblica' : 'Post'}
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Posts Feed */}
      {sortedPosts.map((post) => {
        const isLiked = user && post.likes.includes(user.id);
        const showCommentsForPost = showComments[post.id];

        return (
          <Card key={post.id}>
            <CardContent className="pt-6">
              {/* Post Header */}
              <div className="flex items-start gap-3 mb-4">
                <Avatar>
                  <AvatarFallback className="bg-[#d4b896] text-[#2b2b2b]">
                    {getUserInitials(post.userId)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium text-[#2b2b2b]">{getUserName(post.userId)}</div>
                  <div className="text-sm text-gray-500">
                    {formatDistanceToNow(new Date(post.createdAt), {
                      addSuffix: true,
                      locale: language === 'it' ? it : enUS,
                    })}
                  </div>
                </div>
              </div>

              {/* Post Content */}
              <p className="text-gray-700 mb-4 whitespace-pre-wrap">{post.content}</p>

              {/* Post Actions */}
              <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onLikePost(post.id)}
                  className={isLiked ? 'text-red-500' : ''}
                >
                  <Heart className={`size-4 mr-1 ${isLiked ? 'fill-current' : ''}`} />
                  {post.likes.length}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleComments(post.id)}
                >
                  <MessageCircle className="size-4 mr-1" />
                  {post.comments.length}
                </Button>
              </div>

              {/* Comments Section */}
              {showCommentsForPost && (
                <div className="mt-4 space-y-3">
                  {post.comments.map((comment) => (
                    <div key={comment.id} className="flex gap-2">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-gray-300 text-gray-700 text-xs">
                          {getUserInitials(comment.userId)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 bg-gray-100 rounded-lg p-3">
                        <div className="font-medium text-sm text-[#2b2b2b]">
                          {getUserName(comment.userId)}
                        </div>
                        <p className="text-sm text-gray-700">{comment.content}</p>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDistanceToNow(new Date(comment.createdAt), {
                            addSuffix: true,
                            locale: language === 'it' ? it : enUS,
                          })}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add Comment */}
                  <div className="flex gap-2 mt-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-[#e67e22] text-white text-xs">
                        {user ? getUserInitials(user.id) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 flex gap-2">
                      <Input
                        placeholder={language === 'it' ? 'Scrivi un commento...' : 'Write a comment...'}
                        value={commentInputs[post.id] || ''}
                        onChange={(e) =>
                          setCommentInputs({ ...commentInputs, [post.id]: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmitComment(post.id);
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSubmitComment(post.id)}
                        disabled={!commentInputs[post.id]?.trim()}
                        className="bg-[#e67e22] hover:bg-[#d4b896]"
                      >
                        <Send className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {sortedPosts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageCircle className="size-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">
              {language === 'it' 
                ? 'Nessun post ancora. Sii il primo a condividere qualcosa!' 
                : 'No posts yet. Be the first to share something!'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
