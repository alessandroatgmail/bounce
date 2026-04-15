import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Heart, MessageCircle, Send, Calendar, Clock, Users, MapPin, Plane, Car, Hotel, AtSign } from 'lucide-react';
import { Post, mockStudents, DanceEvent, Trip, RegularClass } from '../data/mockData';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow, format } from 'date-fns';
import { it, enUS } from 'date-fns/locale';

interface SocialFeedProps {
  posts: Post[];
  onAddPost: (content: string, mentions?: string[]) => void;
  onLikePost: (postId: string) => void;
  onAddComment: (postId: string, content: string) => void;
}

export function SocialFeed({ posts, onAddPost, onLikePost, onAddComment }: SocialFeedProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [newPost, setNewPost] = useState('');
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const getUserName = (userId: string) => {
    const student = mockStudents.find(s => s.id === userId);
    return student?.name || 'Unknown User';
  };

  const getUserInitials = (userId: string) => {
    const name = getUserName(userId);
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const handlePostChange = (value: string) => {
    setNewPost(value);

    // Check for @ mention
    const cursorPosition = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtSymbol + 1);
      // Check if there's a space after @, if so, hide dropdown
      if (!textAfterAt.includes(' ')) {
        setMentionQuery(textAfterAt.toLowerCase());
        setMentionPosition(lastAtSymbol);
        setShowMentionDropdown(true);
        setSelectedMentionIndex(0);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  const handleMentionSelect = (student: typeof mockStudents[0]) => {
    const beforeMention = newPost.slice(0, mentionPosition);
    const afterMention = newPost.slice(mentionPosition + mentionQuery.length + 1);
    const newText = `${beforeMention}@${student.name} ${afterMention}`;
    setNewPost(newText);
    setShowMentionDropdown(false);
    textareaRef.current?.focus();
  };

  const extractMentions = (text: string): string[] => {
    const mentionPattern = /@(\w+(?:\s+\w+)*)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionPattern.exec(text)) !== null) {
      const mentionedName = match[1];
      const student = mockStudents.find(s => s.name.toLowerCase() === mentionedName.toLowerCase());
      if (student) {
        mentions.push(student.id);
      }
    }

    return mentions;
  };

  const handleSubmitPost = () => {
    if (newPost.trim()) {
      const mentions = extractMentions(newPost.trim());
      onAddPost(newPost.trim(), mentions);
      setNewPost('');
      setShowMentionDropdown(false);
    }
  };

  const filteredStudents = mockStudents.filter(student =>
    student.name.toLowerCase().includes(mentionQuery) && student.id !== user?.id
  ).slice(0, 5);

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

  const renderPostContent = (content: string, mentions?: string[]) => {
    if (!mentions || mentions.length === 0) {
      return <p className="text-gray-700 mb-4 whitespace-pre-wrap">{content}</p>;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const mentionPattern = /@(\w+(?:\s+\w+)*)/g;
    let match;

    while ((match = mentionPattern.exec(content)) !== null) {
      const mentionedName = match[1];
      const student = mockStudents.find(s => s.name.toLowerCase() === mentionedName.toLowerCase());

      if (student && mentions.includes(student.id)) {
        // Add text before mention
        if (match.index > lastIndex) {
          parts.push(content.slice(lastIndex, match.index));
        }

        // Add highlighted mention
        parts.push(
          <span
            key={`mention-${match.index}`}
            className="text-[#e67e22] font-semibold cursor-pointer hover:underline"
          >
            @{student.name}
          </span>
        );

        lastIndex = match.index + match[0].length;
      }
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return <p className="text-gray-700 mb-4 whitespace-pre-wrap">{parts}</p>;
  };

  const renderSharedContent = (post: Post) => {
    if (!post.sharedContent) return null;

    const { type, data } = post.sharedContent;

    if (type === 'event') {
      const event = data as DanceEvent;
      return (
        <Card className="mt-3 bg-gradient-to-br from-[#d4b896]/10 to-[#e67e22]/10 border-[#d4b896]">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-[#e67e22]/20 rounded-lg">
                <Calendar className="size-6 text-[#e67e22]" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-lg text-[#2b2b2b]">{event.title}</h4>
                  <Badge className="bg-[#d4b896] text-[#2b2b2b]">
                    {event.type.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  {language === 'it' ? 'con' : 'with'} {event.instructor}
                </p>
                <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-4" />
                    {new Date(event.date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-4" />
                    {event.time}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="size-4" />
                    {event.currentEnrollment}/{event.maxCapacity}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-2 line-clamp-2">{event.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (type === 'trip') {
      const trip = data as Trip;
      return (
        <Card className="mt-3 bg-gradient-to-br from-[#2b2b2b]/10 to-[#e67e22]/10 border-[#e67e22]">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-[#e67e22]/20 rounded-lg">
                <Plane className="size-6 text-[#e67e22]" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-lg text-[#2b2b2b]">{trip.eventName}</h4>
                  <Badge className="bg-[#e67e22]">
                    {language === 'it' ? 'Viaggio' : 'Trip'}
                  </Badge>
                </div>
                <div className="flex flex-col gap-2 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <MapPin className="size-4" />
                    {trip.eventLocation}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="size-4" />
                    {format(new Date(trip.eventDate), 'PPP', {
                      locale: language === 'it' ? it : enUS,
                    })}
                  </span>
                  <div className="flex gap-3 mt-1">
                    <span className="flex items-center gap-1">
                      <Car className="size-4 text-[#e67e22]" />
                      {trip.carSharing.length} {language === 'it' ? 'passaggi' : 'rides'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Hotel className="size-4 text-[#e67e22]" />
                      {trip.hotelSharing.length} {language === 'it' ? 'alloggi' : 'rooms'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="size-4 text-[#e67e22]" />
                      {trip.participants.length} {language === 'it' ? 'interessati' : 'interested'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (type === 'course') {
      const course = data as RegularClass;
      const daysOfWeek = language === 'it'
        ? ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
        : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      return (
        <Card className="mt-3 bg-gradient-to-br from-[#d4b896]/10 to-[#c89968]/10 border-[#c89968]">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-[#c89968]/20 rounded-lg">
                <Calendar className="size-6 text-[#c89968]" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-lg text-[#2b2b2b]">{course.title}</h4>
                  <Badge className="bg-[#c89968] text-white">
                    {language === 'it' ? 'Corso Regolare' : 'Regular Class'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  {language === 'it' ? 'con' : 'with'} {course.instructor}
                </p>
                <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-4" />
                    {daysOfWeek[course.dayOfWeek]} - {course.time}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-4" />
                    {course.duration} min
                  </span>
                  <Badge variant="outline">{course.level}</Badge>
                </div>
                <p className="text-sm text-gray-700 mt-2 line-clamp-2">{course.description}</p>
                {course.location && (
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <MapPin className="size-3" />
                    {course.location}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return null;
  };

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
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                placeholder={language === 'it'
                  ? 'Condividi i tuoi pensieri con la community... (usa @ per menzionare amici)'
                  : 'Share your thoughts with the community... (use @ to mention friends)'}
                value={newPost}
                onChange={(e) => handlePostChange(e.target.value)}
                onKeyDown={(e) => {
                  if (showMentionDropdown) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedMentionIndex((prev) =>
                        Math.min(prev + 1, filteredStudents.length - 1)
                      );
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedMentionIndex((prev) => Math.max(prev - 1, 0));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (filteredStudents[selectedMentionIndex]) {
                        handleMentionSelect(filteredStudents[selectedMentionIndex]);
                      }
                    } else if (e.key === 'Escape') {
                      setShowMentionDropdown(false);
                    }
                  }
                }}
                rows={3}
                className="resize-none"
              />

              {/* Mention Dropdown */}
              {showMentionDropdown && filteredStudents.length > 0 && (
                <Card className="absolute z-10 w-full mt-1 max-h-48 overflow-auto shadow-lg">
                  <CardContent className="p-0">
                    {filteredStudents.map((student, index) => (
                      <button
                        key={student.id}
                        onClick={() => handleMentionSelect(student)}
                        className={`w-full flex items-center gap-3 p-3 hover:bg-gray-100 transition-colors ${
                          index === selectedMentionIndex ? 'bg-gray-100' : ''
                        }`}
                      >
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-[#d4b896] text-[#2b2b2b] text-sm">
                            {getUserInitials(student.id)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="text-left">
                          <div className="font-medium text-sm">{student.name}</div>
                          <div className="text-xs text-gray-500">{student.email}</div>
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-between items-center mt-2">
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <AtSign className="size-3" />
                  {language === 'it' ? 'Usa @ per menzionare' : 'Use @ to mention'}
                </div>
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
              {renderPostContent(post.content, post.mentions)}

              {/* Mentioned Users Badge */}
              {post.mentions && post.mentions.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {post.mentions.map((mentionId) => {
                    const mentionedUser = mockStudents.find(s => s.id === mentionId);
                    if (!mentionedUser) return null;
                    return (
                      <Badge key={mentionId} variant="outline" className="text-xs">
                        <AtSign className="size-3 mr-1" />
                        {mentionedUser.name}
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* Shared Content */}
              {renderSharedContent(post)}

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
