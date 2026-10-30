<div class="content-wrapper">
    <section class="content-header">
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-12">
                    <div class="card card-info">
                        <div class="card-header">
                            <h3 class="card-title">TAMBAH LITERASI VIDEO</h3>
                        </div>
                        <div class="card-body">
                            <form action="<?= site_url('Administrator/AddLiterasiVideo') ?>" method="post" enctype="multipart/form-data">
                                <table class="table table-stripped">
                                    <tr>
                                        <td width="150px">Judul Video</td>
                                        <td><input type="text" name="nama_video" class="form-control"></td>
                                    </tr>
                                    <tr>
                                        <td width="150px">Deskripsi</td>
                                        <td><input type="text" name="deskripsi" class="form-control"></td>
                                    </tr>
                                    <tr>
                                        <td>File</td>
                                        <td>
                                            <input type="file" name="file_video" class="form-control">
                                        </td>
                                    </tr>

                                    <tr>
                                        <td colspan="2">
                                            <button type="submit" class="btn btn-info"><i class="fas fa-save"></i> Simpan</button>
                                            <a href="<?= site_url('Administrator/literasi_video') ?>" class="btn btn-danger" id="tblback"><i class="fas fa-reply"></i> Kembali</a>
                                        </td>
                                    </tr>
                                </table>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</div>