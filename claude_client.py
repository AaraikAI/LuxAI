"""
Claude API Client for LuxAI
A wrapper around Anthropic's Claude API for easy integration.
"""

import os
from typing import Optional, Dict, List, Any
from anthropic import Anthropic


class ClaudeClient:
    """Client for interacting with Claude API."""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Claude client.
        
        Args:
            api_key: Anthropic API key. If not provided, will use ANTHROPIC_API_KEY env var.
        """
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError(
                "API key required. Set ANTHROPIC_API_KEY environment variable "
                "or pass api_key parameter."
            )
        self.client = Anthropic(api_key=self.api_key)
    
    def chat(
        self,
        message: str,
        model: str = "claude-3-5-sonnet-20241022",
        system_prompt: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 1.0,
        **kwargs
    ) -> str:
        """
        Send a chat message to Claude and get a response.
        
        Args:
            message: User message to send
            model: Claude model to use (default: claude-3-5-sonnet-20241022)
            system_prompt: Optional system prompt
            max_tokens: Maximum tokens in response
            temperature: Sampling temperature (0.0 to 1.0)
            **kwargs: Additional parameters for the API call
            
        Returns:
            Claude's response text
        """
        messages = [{"role": "user", "content": message}]
        
        params = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            **kwargs
        }
        
        if system_prompt:
            params["system"] = system_prompt
        
        response = self.client.messages.create(**params)
        return response.content[0].text
    
    def chat_stream(
        self,
        message: str,
        model: str = "claude-3-5-sonnet-20241022",
        system_prompt: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 1.0,
        **kwargs
    ):
        """
        Send a chat message to Claude and get a streaming response.
        
        Args:
            message: User message to send
            model: Claude model to use
            system_prompt: Optional system prompt
            max_tokens: Maximum tokens in response
            temperature: Sampling temperature
            **kwargs: Additional parameters
            
        Yields:
            Text chunks from Claude's streaming response
        """
        messages = [{"role": "user", "content": message}]
        
        params = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
            **kwargs
        }
        
        if system_prompt:
            params["system"] = system_prompt
        
        with self.client.messages.stream(**params) as stream:
            for text in stream.text_stream:
                yield text
    
    def chat_with_history(
        self,
        messages: List[Dict[str, str]],
        model: str = "claude-3-5-sonnet-20241022",
        system_prompt: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 1.0,
        **kwargs
    ) -> str:
        """
        Send a conversation with history to Claude.
        
        Args:
            messages: List of message dicts with 'role' and 'content' keys
            model: Claude model to use
            system_prompt: Optional system prompt
            max_tokens: Maximum tokens in response
            temperature: Sampling temperature
            **kwargs: Additional parameters
            
        Returns:
            Claude's response text
        """
        params = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            **kwargs
        }
        
        if system_prompt:
            params["system"] = system_prompt
        
        response = self.client.messages.create(**params)
        return response.content[0].text
    
    def get_available_models(self) -> List[str]:
        """
        Get list of available Claude models.
        
        Returns:
            List of model names
        """
        return [
            "claude-3-5-sonnet-20241022",
            "claude-3-5-haiku-20241022",
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307",
        ]


# Example usage
if __name__ == "__main__":
    # Initialize client (requires ANTHROPIC_API_KEY environment variable)
    try:
        client = ClaudeClient()
        
        # Simple chat
        response = client.chat("Hello, Claude! Can you introduce yourself?")
        print("Claude:", response)
        
        # Chat with system prompt
        response = client.chat(
            "What is the capital of France?",
            system_prompt="You are a helpful assistant that provides accurate information."
        )
        print("\nClaude:", response)
        
        # Streaming response
        print("\nStreaming response:")
        for chunk in client.chat_stream("Tell me a short joke."):
            print(chunk, end="", flush=True)
        print()
        
    except ValueError as e:
        print(f"Error: {e}")
        print("\nPlease set your ANTHROPIC_API_KEY environment variable:")
        print("export ANTHROPIC_API_KEY='your-api-key-here'")



