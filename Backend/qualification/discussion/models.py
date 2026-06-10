# discussion/models.py

from django.db import models
from users.models import User
from submissions.models import Submission


class Comment(models.Model):
    
    submission = models.ForeignKey(
        Submission,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    
    author = models.ForeignKey(
        User, 
        on_delete=models.CASCADE,
        related_name='comments'
    )
    
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies'
    )
    
    text = models.TextField("Коментар")
    
    rating = models.IntegerField(default=0)
    
    likes_count = models.IntegerField(default=0)
    dislikes_count = models.IntegerField(default=0)
    replies_count = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    is_deleted = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-rating', '-created_at']
        indexes = [
            models.Index(fields=['submission', 'parent']),
            models.Index(fields=['-rating']),
            models.Index(fields=['created_at']),
        ]
    
    @property
    def is_root(self):
        return self.parent is None
    
    def delete(self, using=None, keep_parents=False):
        self.is_deleted = True
        self.text = "[Коментар видалено]"
        self.save()
    
    def __str__(self):
        return f"{self.author.username}: {self.text[:50]}"


class CommentVote(models.Model):
    VOTE_CHOICES = [
        (1, 'Лайк'),
        (-1, 'Дизлайк'),
    ]
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='comment_votes'
    )
    
    comment = models.ForeignKey(
        Comment,
        on_delete=models.CASCADE,
        related_name='votes'
    )
    
    vote = models.SmallIntegerField(choices=VOTE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('user', 'comment')  
        indexes = [
            models.Index(fields=['user', 'comment']),
        ]
    
    def __str__(self):
        vote_text = "1" if self.vote == 1 else "0"
        return f"{self.user.username} {vote_text} {self.comment.id}"