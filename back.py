from typing import List
from flask import Flask, Response, request, redirect, make_response
from flask_cors import CORS
import os
import re
import json
from datetime import timedelta

port = 3333
prefix = '/home/yz/test/'
video_exts = frozenset(['.mp4'])

app = Flask(__name__,
            static_url_path='/',
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
    if request.method == 'GET':
        range_header = request.headers.get('Range', None)
        arg_file = request.args.get("file", None)
        if arg_file is None:
            return make_response('bad request', 400)
        file = '.' + arg_file
        byte1, byte2 = 0, None
        if range_header:
            match = re.search(r'(\d+)-(\d*)', range_header)
            if match is None:
                return make_response('bad request', 400)
            groups = match.groups()

            if groups[0]:
                byte1 = int(groups[0])
            if groups[1]:
                byte2 = int(groups[1])

        chunk, start, length, file_size = get_chunk(
            os.path.join(prefix, file), byte1, byte2)
        resp = Response(chunk, 206, mimetype='video/mp4',
                        content_type='video/mp4', direct_passthrough=True)
        resp.headers.add(
            'Content-Range', 'bytes {0}-{1}/{2}'.format(start, start + length - 1, file_size))
        return resp


def time2str(sec: float) -> str:
    time_str = str(timedelta(seconds=sec))
    return time_str+'.000' if (sec-int(sec)) == 0 else time_str[:-3]


def str2time(string: str) -> float:
    match = re.match(r'(\d+):(\d\d):(\d\d)\.(\d\d\d)', string)
    if match is None:
        raise ValueError('time fromat error')
    h = int(match.group(1))
    m = int(match.group(2))
    s = int(match.group(3))
    ms = int(match.group(4))
    return (((h*60)+m)*60)+s+ms*0.001


@app.route('/api/label', methods=['GET', 'PUT'])
def api_label():
    label_path = os.path.join(os.path.dirname(__file__), 'labels.json')
    if request.method == 'GET':
        with open(label_path) as f:
            bytes = f.read()
        return Response(bytes,  mimetype='application/json')
    if request.method == 'PUT':
        request_json = request.get_json()
        with open(label_path, 'w+') as f:
            json.dump(request_json, f, ensure_ascii=False)
        return 'ok'


@app.route('/api/videoLabel', methods=['GET', 'PUT'])
def api_video_label():
    if request.method == 'GET':
        arg_file = request.args.get("file", None)
        if arg_file is None:
            return make_response('bad request', 400)
        file = os.path.join(prefix, '.'+arg_file)
        withoutext, _ = os.path.splitext(file)
        label_file = f'{withoutext}.txt'
        if not os.path.exists(label_file):
            return Response('[]',  mimetype='application/json')
        data = []
        with open(label_file, 'r+') as f:
            while True:
                a, b, c = [f.readline() for _ in range(3)]
                if len(a) == 0:
                    break
                pattern = r'^(\d+:\d\d:\d\d\.\d\d\d) - (\d+:\d\d:\d\d\.\d\d\d)'
                match = re.match(pattern, b)
                if match is None:
                    print(f'label file: {label_file} broken')
                    break
                item = {
                    'label': a[:-1],
                    'range': [str2time(match.group(i)) for i in (1, 2)]
                }
                data.append(item)
        return Response(json.dumps(data),  mimetype='application/json')

    if request.method == 'PUT':
        request_json = request.get_json()
        if request_json is None:
            return make_response('bad request', 400)
        key: str = request_json['key']
        withoutext, _ = os.path.splitext(os.path.join(prefix, '.'+key))
        data = request_json['data']
        with open(f'{withoutext}.txt', 'w+') as f:
            for item in data:
                time_range: List[str] = list(map(time2str, item['range']))
                label: str = item['label']
                f.write(f'{label}\n{time_range[0]} - {time_range[1]}\n\n')
        return "ok"


if __name__ == '__main__':
    app.run(port=port)
