#!/usr/bin/env python3
"""LLM helper — called by Node.js cerebras.mjs via subprocess.

Supports Groq and OpenRouter via their Python SDKs.

Usage:
  python groq_helper.py chat    --provider groq|openrouter --key KEY --model MODEL --messages JSON [--temp T] [--max-tokens N]
  python groq_helper.py stream  --provider groq|openrouter --key KEY --model MODEL --messages JSON [--temp T] [--max-tokens N]
  python groq_helper.py models  --provider groq|openrouter --key KEY

Non-streaming: prints JSON { content, model, usage }.
Streaming: prints one JSON line per chunk { delta, fullText } then final { done, fullText, model }.
"""

import argparse
import json
import os
import sys


def make_client(args):
    proxy = args.proxy or os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")
    http_client = None
    if proxy:
        import httpx
        http_client = httpx.Client(proxy=proxy)

    provider = args.provider or 'groq'
    if provider == 'openrouter':
        from openai import OpenAI
        kwargs = {
            "api_key": args.key,
            "base_url": "https://openrouter.ai/api/v1",
        }
        if http_client:
            kwargs["http_client"] = http_client
        return OpenAI(**kwargs), 'openai'
    else:
        from groq import Groq
        kwargs = {"api_key": args.key}
        if http_client:
            kwargs["http_client"] = http_client
        return Groq(**kwargs), 'groq'


def cmd_chat(args):
    client, sdk = make_client(args)
    messages = json.loads(args.messages)
    completion = client.chat.completions.create(
        model=args.model,
        messages=messages,
        temperature=args.temp,
        max_completion_tokens=args.max_tokens,
        stream=False,
    )
    usage = None
    if completion.usage:
        usage = {
            "prompt_tokens": getattr(completion.usage, 'prompt_tokens', 0),
            "completion_tokens": getattr(completion.usage, 'completion_tokens', 0),
            "total_tokens": getattr(completion.usage, 'total_tokens', 0),
        }
    result = {
        "content": completion.choices[0].message.content or "",
        "model": getattr(completion, 'model', args.model),
        "usage": usage,
    }
    print(json.dumps(result, ensure_ascii=False))


def cmd_stream(args):
    client, sdk = make_client(args)
    messages = json.loads(args.messages)
    stream = client.chat.completions.create(
        model=args.model,
        messages=messages,
        temperature=args.temp,
        max_completion_tokens=args.max_tokens,
        stream=True,
    )
    full_text = ""
    for chunk in stream:
        delta = chunk.choices[0].delta.content if chunk.choices and chunk.choices[0].delta else None
        if delta:
            full_text += delta
            print(json.dumps({"delta": delta, "fullText": full_text}, ensure_ascii=False))
            sys.stdout.flush()
    print(json.dumps({"done": True, "fullText": full_text, "model": args.model}, ensure_ascii=False))


def cmd_models(args):
    client, sdk = make_client(args)
    if sdk == 'openai':
        # OpenRouter uses OpenAI SDK
        r = client.models.list()
        for m in r.data:
            print(json.dumps({"id": m.id, "active": True, "owned_by": getattr(m, "owned_by", "")}, ensure_ascii=False))
    else:
        models = client.models.list()
        for m in models.data:
            print(json.dumps({"id": m.id, "active": m.active, "owned_by": getattr(m, "owned_by", "")}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd")

    for name in ("chat", "stream"):
        p = sub.add_parser(name)
        p.add_argument("--provider", default="groq", choices=["groq", "openrouter"])
        p.add_argument("--key", required=True)
        p.add_argument("--model", required=True)
        p.add_argument("--messages", required=True, help="JSON array of messages")
        p.add_argument("--temp", type=float, default=0.7)
        p.add_argument("--max-tokens", type=int, default=4096)
        p.add_argument("--proxy", default=None, help="SOCKS5/HTTP proxy URL")

    p_models = sub.add_parser("models")
    p_models.add_argument("--provider", default="groq", choices=["groq", "openrouter"])
    p_models.add_argument("--key", required=True)
    p_models.add_argument("--proxy", default=None)

    args = parser.parse_args()
    if args.cmd == "chat":
        cmd_chat(args)
    elif args.cmd == "stream":
        cmd_stream(args)
    elif args.cmd == "models":
        cmd_models(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
