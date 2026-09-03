#!/usr/bin/env python3
"""LLM helper - AI chat via OpenCode Zen (big-pickle), Pollinations fallback.

Primary provider: OpenCode Zen (opencode.ai/zen/v1) - OpenAI-compatible,
works from RU without VPN. Default model: big-pickle (reasoning model).
Fallback: Pollinations.ai (free, no auth, gpt-oss-20b).

Reads config from root .env (OPENCODE_API_KEY / OPENCODE_MODEL / OPENCODE_BASE_URL).

Usage:
  python llm_helper.py chat   --messages JSON [--temp T] [--max-tokens N]
  python llm_helper.py stream --messages JSON [--temp T] [--max-tokens N]
  python llm_helper.py models
"""

import argparse
import json
import os
import sys
import time
import urllib.parse

# Force UTF-8 output on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')


def _load_env(path):
    """Minimal dotenv loader (no dependency needed)."""
    try:
        with open(path, 'r', encoding='utf-8-sig') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, v = line.split('=', 1)
                k = k.strip()
                v = v.strip()
                if v.startswith('"') and v.endswith('"'):
                    v = v[1:-1]
                elif v.startswith("'") and v.endswith("'"):
                    v = v[1:-1]
                os.environ.setdefault(k, v)
    except Exception as e:
        print(f"[env] could not load {path}: {e}", file=sys.stderr)


_load_env(
    os.path.join(
        os.path.dirname(os.path.abspath(__file__)), '..', '..', '.env'
    )
)

ZEN_BASE = os.environ.get('OPENCODE_BASE_URL', 'https://opencode.ai/zen/v1').rstrip('/')
ZEN_KEY = os.environ.get('OPENCODE_API_KEY', '')
ZEN_MODEL = os.environ.get('OPENCODE_MODEL', 'big-pickle')

# Rate limiting per provider (seconds between requests).
_MIN_INTERVAL = 6

_last_call = 0


def _rate_limit():
    global _last_call
    elapsed = time.time() - _last_call
    if elapsed < _MIN_INTERVAL:
        wait = _MIN_INTERVAL - elapsed
        print(f"[rate-limit] waiting {wait:.1f}s", file=sys.stderr)
        time.sleep(wait)
    _last_call = time.time()


def _zen_request(messages, max_tokens, temp, stream=False):
    """POST to OpenCode Zen chat completions. Returns parsed JSON or None."""
    import httpx

    if not ZEN_KEY:
        print("[zen] no OPENCODE_API_KEY configured", file=sys.stderr)
        return None

    payload = {
        'model': ZEN_MODEL,
        'messages': messages,
        'temperature': temp,
        'max_tokens': max_tokens,
    }
    if stream:
        payload['stream'] = True

    headers = {
        'Authorization': f'Bearer {ZEN_KEY}',
        'Content-Type': 'application/json',
    }

    for attempt in range(3):
        _rate_limit()
        try:
            r = httpx.post(
                f'{ZEN_BASE}/chat/completions',
                json=payload,
                headers=headers,
                timeout=90,
            )
            if r.status_code == 200:
                return r.json()
            if r.status_code == 429:
                print(f"[zen] 429 rate-limit (attempt {attempt+1}), retry soon", file=sys.stderr)
                time.sleep(4)
                continue
            print(f"[zen] {r.status_code} ... {r.text[:200]}", file=sys.stderr)
            # 401/404 = auth/model issue, don't hammer
            if r.status_code in (401, 403):
                break
            time.sleep(2)
        except Exception as e:
            print(f"[zen] error: {e} (attempt {attempt+1})", file=sys.stderr)
            time.sleep(2)
    return None


def _pollinations_post(messages, max_tokens, temp, retries=2):
    """POST to Pollinations OpenAI-compatible endpoint."""
    import httpx

    for attempt in range(retries):
        _rate_limit()
        try:
            r = httpx.post(
                'https://text.pollinations.ai/openai',
                json={
                    'model': 'openai',
                    'messages': messages,
                    'temperature': temp,
                    'max_tokens': max_tokens,
                },
                timeout=45,
            )
            if r.status_code == 200:
                return r.json()
            print(f"[pollinations] {r.status_code} (attempt {attempt+1})", file=sys.stderr)
            time.sleep(3)
        except Exception as e:
            print(f"[pollinations] error: {e} (attempt {attempt+1})", file=sys.stderr)
            time.sleep(3)
    return None


def _pollinations_get(messages, max_tokens):
    """GET endpoint fallback - simpler for single-turn."""
    import httpx

    prompt_parts = []
    for m in messages:
        role = m.get('role', 'user')
        content = m.get('content', '')
        if role == 'system':
            prompt_parts.append(content)
        elif role == 'user':
            prompt_parts.append(f"User: {content}")
        elif role == 'assistant':
            prompt_parts.append(f"Assistant: {content}")
    prompt_parts.append("Assistant:")
    prompt = '\n'.join(prompt_parts)

    _rate_limit()
    try:
        encoded = urllib.parse.quote(prompt[:2000])
        url = f'https://text.pollinations.ai/{encoded}?model=openai&nologo=true&max={max_tokens}'
        r = httpx.get(url, timeout=60)
        if r.status_code == 200:
            return {'choices': [{'message': {'content': r.text.strip()}}], 'model': 'gpt-oss-20b'}
        print(f"[pollinations/get] {r.status_code}", file=sys.stderr)
    except Exception as e:
        print(f"[pollinations/get] error: {e}", file=sys.stderr)
    return None


def _pollinations(messages, max_tokens, temp):
    """Pollinations POST with GET fallback."""
    data = _pollinations_post(messages, max_tokens=max_tokens, temp=temp)
    if data:
        return data
    print("[fallback] Pollinations GET", file=sys.stderr)
    return _pollinations_get(messages, max_tokens=max_tokens)


def _provider_of(data):
    return data.get('provider', '')  # injected marker if present


def cmd_chat(args):
    messages = json.loads(args.messages)
    provider = 'opencode'
    data = _zen_request(messages, max_tokens=args.max_tokens, temp=args.temp)
    if data is None:
        print("[fallback] Pollinations", file=sys.stderr)
        data = _pollinations(messages, max_tokens=args.max_tokens, temp=args.temp)
        provider = 'pollinations' if data else None

    if data is None:
        print(json.dumps({"error": "All LLM providers unavailable"}))
        sys.exit(1)

    content = data['choices'][0]['message'].get('content') or ""
    usage = data.get('usage')
    result = {
        "content": content,
        "model": data.get('model', ZEN_MODEL if provider == 'opencode' else 'gpt-oss-20b'),
        "provider": provider,
        "usage": {
            "prompt_tokens": usage.get('prompt_tokens', 0),
            "completion_tokens": usage.get('completion_tokens', 0),
            "total_tokens": usage.get('total_tokens', 0),
        } if usage else None,
    }
    print(json.dumps(result, ensure_ascii=False))


def cmd_stream(args):
    messages = json.loads(args.messages)
    provider = 'opencode'

    # Try streaming via OpenCode Zen.
    import httpx

    if ZEN_KEY:
        payload = {
            'model': ZEN_MODEL,
            'messages': messages,
            'temperature': args.temp,
            'max_tokens': args.max_tokens,
            'stream': True,
        }
        headers = {'Authorization': f'Bearer {ZEN_KEY}', 'Content-Type': 'application/json'}
        full_text = ''
        # Providers throttle aggressively; retry 429s like _zen_request does.
        max_attempts = 3
        for attempt in range(max_attempts):
            _rate_limit()
            try:
                with httpx.stream(
                    'POST', f'{ZEN_BASE}/chat/completions',
                    json=payload, headers=headers, timeout=120,
                ) as r:
                    if r.status_code == 429:
                        print(f"[zen/stream] 429 rate-limit (attempt {attempt+1}/{max_attempts})", file=sys.stderr)
                        time.sleep(8)
                        continue
                    if r.status_code != 200:
                        print(f"[zen/stream] {r.status_code}", file=sys.stderr)
                        if r.status_code in (401, 403):
                            break
                        time.sleep(2)
                        continue

                    content_acc = ''
                    for line in r.iter_lines():
                        if not line or not line.startswith('data:'):
                            continue
                        payload_str = line[5:].strip()
                        if payload_str == '[DONE]':
                            break
                        try:
                            chunk = json.loads(payload_str)
                        except json.JSONDecodeError:
                            continue
                        # Providers emit service frames with empty choices
                        # (e.g. final usage report) — never index blindly.
                        choices = chunk.get('choices') or []
                        delta = (choices[0].get('delta') if choices else None) or {}
                        c = delta.get('content') or ''
                        # reasoning model may interleave reasoning_content; only
                        # surface reasoning if no content has arrived yet
                        rc = delta.get('reasoning_content') or ''
                        if c:
                            content_acc += c
                            full_text += c
                            print(json.dumps({"delta": c, "fullText": full_text}, ensure_ascii=False))
                            sys.stdout.flush()
                        elif rc and not content_acc:
                            continue

                    if full_text:
                        print(json.dumps(
                            {"done": True, "fullText": full_text, "model": ZEN_MODEL, "provider": "opencode"},
                            ensure_ascii=False))
                        return
            except Exception as e:
                print(f"[zen/stream] error: {e}", file=sys.stderr)
                # Stream died mid-flight but we already delivered partial content —
                # ship it instead of re-fetching (would duplicate the answer).
                if full_text:
                    print(json.dumps(
                        {"done": True, "fullText": full_text, "model": ZEN_MODEL, "provider": "opencode"},
                        ensure_ascii=False))
                    return
                time.sleep(2)

    # Fallback: non-streaming chat (any provider).
    print("[stream/fallback] non-streaming", file=sys.stderr)
    data = _zen_request(messages, max_tokens=args.max_tokens, temp=args.temp)
    provider = 'opencode'
    if data is None:
        data = _pollinations(messages, max_tokens=args.max_tokens, temp=args.temp)
        provider = 'pollinations'
    if data is None:
        print(json.dumps({"error": "All LLM providers unavailable"}))
        sys.exit(1)

    content = data['choices'][0]['message'].get('content') or ""
    full_text = ""
    for i in range(0, len(content), 5):
        chunk = content[i:i+5]
        full_text += chunk
        print(json.dumps({"delta": chunk, "fullText": full_text}, ensure_ascii=False))
        sys.stdout.flush()
    print(json.dumps({"done": True, "fullText": full_text, "model": data.get('model', ZEN_MODEL), "provider": provider}, ensure_ascii=False))


def cmd_models(args):
    print(json.dumps({
        "id": ZEN_MODEL,
        "name": f"Big Pickle / {ZEN_MODEL} (OpenCode Zen)",
        "active": bool(ZEN_KEY),
        "context": "128K+",
        "rateLimit": "paced (~6s between reqs)",
    }))


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd")

    for name in ("chat", "stream"):
        p = sub.add_parser(name)
        p.add_argument("--messages", required=True, help="JSON array of messages")
        p.add_argument("--temp", type=float, default=0.7)
        p.add_argument("--max-tokens", type=int, default=4096)

    sub.add_parser("models")

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
