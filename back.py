from typing import List
from flask import Flask, Response, request, redirect
from flask_cors import CORS
import os
import re
import json
from datetime import datetime, timedelta

prefix = '/home/yz/test/'
video_exts = frozenset(['.mp4'])

app = Flask(__name__, static_url_path='/',
            static_folder='build')
CORS(app)


@app.route('/')
def main():
    return redirect('/index.html')


@app.route('/api/hello')
def api_hello():
    return 'Hello'


@app.route('/api/files', methods=['GET'])
def api_files():
    result = []
    for dirname, dirs, files in os.walk(prefix):
        video_files = [file for file in files
                       if os.path.splitext(file)[1] in video_exts]
        result.append([dirname, dirs, video_files])
    return Response(json.dumps(result),  mimetype='application/json')


def get_chunk(full_path: str, byte1=None, byte2=None):
    file_size = os.stat(full_path).st_size
    start = 0

    if byte1 < file_size:
        start = byte1
    if byte2:
        length = byte2 + 1 - byte1
    else:
        length = file_size - start

    with open(full_path, 'rb') as f:
        f.seek(start)
        chunk = f.read(length)
    return chunk, start, length, file_size


@app.route('/api/video', methods=['GET'])
def api_file():
    match request.method:
        case 'GET':
            range_header = request.headers.get('Range', None)
            file = request.args.get('file', None)
            byte1, byte2 = 0, None
            if range_header:
                match = re.search(r'(\d+)-(\d*)', range_header)
                groups = match.groups()

                if groups[0]:
                    byte1 = int(groups[0])
                if groups[1]:
                    byte2 = int(groups[1])

            chunk, start, length, file_size = get_chunk(
                f'{prefix}{file}', byte1, byte2)
            resp = Response(chunk, 206, mimetype='video/mp4',
                            content_type='video/mp4', direct_passthrough=True)
            resp.headers.add(
                'Content-Range', 'bytes {0}-{1}/{2}'.format(start, start + length - 1, file_size))
            return resp


def time2str(sec: float) -> str:
    return str(timedelta(seconds=sec))[:-3]


def str2time(string: str) -> float:
    match = re.match(r'(\d+):(\d\d):(\d\d)\.(\d\d\d)', string)
    h = int(match.group(1))
    m = int(match.group(2))
    s = int(match.group(3))
    ms = int(match.group(4))
    return (((h*60)+m)*60)+s+ms*0.001


@app.route('/api/label', methods=['GET', 'PUT'])
def api_label():
    match request.method:
        case 'GET':
            with open('./labels.json') as f:
                bytes = f.read()
            return Response(bytes,  mimetype='application/json')
        case 'PUT':
            request_json = request.get_json()
            with open('./labels.json', 'w+') as f:
                f.write(json.dumps(request_json))
            return 'ok'


@app.route('/api/videoLabel', methods=['GET', 'PUT'])
def api_video_label():
    match request.method:
        case 'GET':
            file = f'{prefix}{request.args.get("file", None)}'
            withoutext, _ = os.path.splitext(file)
            label_file = f'{withoutext}.txt'
            if not os.path.exists(label_file):
                return Response('[]',  mimetype='application/json')
            data = []
            with open(f'{withoutext}.txt', 'r+') as f:
                while True:
                    a, b, c = [f.readline() for _ in range(3)]
                    if len(a) == 0:
                        break
                    pattern = r'^(\d+:\d\d:\d\d\.\d\d\d) - (\d+:\d\d:\d\d\.\d\d\d)'
                    match = re.match(pattern, b)
                    item = {
                        'label': a[:-1],
                        'range': [str2time(match.group(i)) for i in (1, 2)]
                    }
                    data.append(item)
            return Response(json.dumps(data),  mimetype='application/json')

        case 'PUT':
            request_json = request.get_json()
            key: str = request_json['key']
            withoutext, _ = os.path.splitext(f'{prefix}{key}')
            data = request_json['data']
            with open(f'{withoutext}.txt', 'w+') as f:
                for item in data:
                    time_range: List[str] = list(map(time2str, item['range']))
                    label: str = item['label']
                    f.write(f'{label}\n{time_range[0]} - {time_range[1]}\n\n')
            return "ok"


if __name__ == '__main__':
    app.run(port=3333)
