"""
Example usage of Claude Client for LuxAI
"""

from claude_client import ClaudeClient
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def example_basic_chat():
    """Example of basic chat interaction."""
    print("=" * 50)
    print("Example 1: Basic Chat")
    print("=" * 50)
    
    client = ClaudeClient()
    response = client.chat("What is artificial intelligence?")
    print(f"Response: {response}\n")


def example_system_prompt():
    """Example using a system prompt."""
    print("=" * 50)
    print("Example 2: Chat with System Prompt")
    print("=" * 50)
    
    client = ClaudeClient()
    response = client.chat(
        "Explain quantum computing in simple terms.",
        system_prompt="You are a science educator who explains complex topics in simple, engaging ways."
    )
    print(f"Response: {response}\n")


def example_streaming():
    """Example of streaming response."""
    print("=" * 50)
    print("Example 3: Streaming Response")
    print("=" * 50)
    
    client = ClaudeClient()
    print("Response (streaming): ", end="", flush=True)
    for chunk in client.chat_stream("Write a haiku about coding."):
        print(chunk, end="", flush=True)
    print("\n")


def example_conversation_history():
    """Example with conversation history."""
    print("=" * 50)
    print("Example 4: Conversation with History")
    print("=" * 50)
    
    client = ClaudeClient()
    
    messages = [
        {"role": "user", "content": "My name is Alice."},
        {"role": "assistant", "content": "Nice to meet you, Alice! How can I help you today?"},
        {"role": "user", "content": "What's my name?"}
    ]
    
    response = client.chat_with_history(messages)
    print(f"Response: {response}\n")


def example_different_models():
    """Example using different Claude models."""
    print("=" * 50)
    print("Example 5: Using Different Models")
    print("=" * 50)
    
    client = ClaudeClient()
    models = client.get_available_models()
    
    print("Available models:")
    for model in models:
        print(f"  - {model}")
    
    # Try with Haiku (faster, cheaper)
    print("\nUsing Claude Haiku:")
    response = client.chat(
        "What is 2+2?",
        model="claude-3-5-haiku-20241022"
    )
    print(f"Response: {response}\n")


def main():
    """Run all examples."""
    try:
        # Check if API key is set
        if not os.getenv("ANTHROPIC_API_KEY"):
            print("Error: ANTHROPIC_API_KEY environment variable not set.")
            print("Please set it in your .env file or export it:")
            print("export ANTHROPIC_API_KEY='your-api-key-here'")
            return
        
        example_basic_chat()
        example_system_prompt()
        example_streaming()
        example_conversation_history()
        example_different_models()
        
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()



